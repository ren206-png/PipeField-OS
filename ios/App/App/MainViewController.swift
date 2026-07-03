// MainViewController.swift
// Subclass of CAPBridgeViewController that:
//   1. Registers VercelProxyHandler for the "apphttps" URL scheme so
//      WKWebView can load Vercel content WITHOUT triggering iOS's browser toolbar.
//   2. After the Capacitor bridge loads, installs a navigation-delegate proxy so
//      WKWebView is allowed to navigate to apphttps:// URLs (Capacitor would
//      otherwise intercept them and try to open them externally).
//   3. Navigates to apphttps://pipefield-os.vercel.app/ via the proxy.

import UIKit
import Capacitor
import WebKit

@objc(MainViewController)
class MainViewController: CAPBridgeViewController {

    // MARK: - Capacitor override: register proxy scheme

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)
        config.setURLSchemeHandler(VercelProxyHandler(), forURLScheme: "apphttps")
        return config
    }

    // MARK: - Navigation delegate proxy (keeps a strong reference)

    private var navDelegateProxy: AppHttpsNavProxy?

    // MARK: - After bridge is ready, install proxy and redirect to Vercel

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let wv = self.webView else { return }
            // Wrap Capacitor's navigation delegate so apphttps:// navigations are
            // allowed instead of being intercepted and sent to LaunchServices.
            let proxy = AppHttpsNavProxy(original: wv.navigationDelegate)
            self.navDelegateProxy = proxy
            wv.navigationDelegate = proxy
            self.loadProxyURL()
        }
    }

    private func loadProxyURL() {
        guard let wv = webView,
              let url = URL(string: "apphttps://pipefield-os.vercel.app/")
        else { return }
        wv.load(URLRequest(url: url))
    }
}

// MARK: - AppHttpsNavProxy

/// Wraps an existing WKNavigationDelegate, passing through all calls except
/// decidePolicyFor navigationAction where apphttps:// is always allowed.
class AppHttpsNavProxy: NSObject, WKNavigationDelegate {

    private weak var original: WKNavigationDelegate?

    init(original: WKNavigationDelegate?) {
        self.original = original
        super.init()
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.request.url?.scheme == "apphttps" {
            decisionHandler(.allow)
            return
        }
        if let orig = original {
            orig.webView?(webView, decidePolicyFor: navigationAction, decisionHandler: decisionHandler)
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        original?.webView?(webView, didStartProvisionalNavigation: navigation)
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        original?.webView?(webView, didCommit: navigation)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        original?.webView?(webView, didFinish: navigation)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        original?.webView?(webView, didFail: navigation, withError: error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        original?.webView?(webView, didFailProvisionalNavigation: navigation, withError: error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        original?.webViewWebContentProcessDidTerminate?(webView)
    }
}
