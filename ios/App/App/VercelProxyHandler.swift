// VercelProxyHandler.swift
// Intercepts requests to the custom "apphttps" URL scheme and proxies them
// to https://pipefield-os.vercel.app.  This lets WKWebView load the live
// Vercel app under a non-http(s) scheme so iOS never shows the browser toolbar.

import Foundation
import WebKit

class VercelProxyHandler: NSObject, WKURLSchemeHandler {

    private let vercelHost = "pipefield-os.vercel.app"
    /// Tracks in-flight tasks so we can cancel them when the scheme task stops.
    private var activeTasks: [ObjectIdentifier: URLSessionDataTask] = [:]
    private let lock = NSLock()

    // MARK: - WKURLSchemeHandler

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard
            let requestURL = urlSchemeTask.request.url,
            var components = URLComponents(url: requestURL, resolvingAgainstBaseURL: false)
        else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        // Rewrite scheme: apphttps:// → https://
        components.scheme = "https"
        components.host   = vercelHost          // ensure we always hit Vercel

        guard let targetURL = components.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        // Build the proxied request, forwarding method + body + headers
        var proxiedRequest = URLRequest(url: targetURL, cachePolicy: .reloadIgnoringLocalCacheData)
        proxiedRequest.httpMethod = urlSchemeTask.request.httpMethod ?? "GET"
        proxiedRequest.httpBody   = urlSchemeTask.request.httpBody

        urlSchemeTask.request.allHTTPHeaderFields?.forEach { key, value in
            // Don't forward Host — URLSession sets it from the URL
            if key.lowercased() != "host" {
                proxiedRequest.setValue(value, forHTTPHeaderField: key)
            }
        }

        let session = URLSession.shared
        let task = session.dataTask(with: proxiedRequest) { [weak self] data, response, error in
            guard let self = self else { return }

            // Remove from active map before calling task methods
            self.lock.lock()
            self.activeTasks.removeValue(forKey: ObjectIdentifier(urlSchemeTask))
            self.lock.unlock()

            // All WKURLSchemeTask calls must happen on the main thread
            DispatchQueue.main.async {
                if let error = error {
                    urlSchemeTask.didFailWithError(error)
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse else {
                    urlSchemeTask.didFailWithError(URLError(.badServerResponse))
                    return
                }

                // Rewrite any redirect Location header so it stays on apphttps://
                var headers = (httpResponse.allHeaderFields as? [String: String]) ?? [:]
                if let loc = headers["Location"] {
                    headers["Location"] = loc.replacingOccurrences(
                        of: "https://\(self.vercelHost)",
                        with: "apphttps://\(self.vercelHost)"
                    )
                }

                guard let responseURL = httpResponse.url,
                      let modResponse = HTTPURLResponse(
                          url: responseURL,
                          statusCode: httpResponse.statusCode,
                          httpVersion: "HTTP/1.1",
                          headerFields: headers
                      )
                else {
                    urlSchemeTask.didFailWithError(URLError(.badServerResponse))
                    return
                }

                urlSchemeTask.didReceive(modResponse)
                if let data = data { urlSchemeTask.didReceive(data) }
                urlSchemeTask.didFinish()
            }
        }

        lock.lock()
        activeTasks[ObjectIdentifier(urlSchemeTask)] = task
        lock.unlock()

        task.resume()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        lock.lock()
        let task = activeTasks.removeValue(forKey: ObjectIdentifier(urlSchemeTask))
        lock.unlock()
        task?.cancel()
    }
}
