import React from 'react'
import { Document, Page, View, Text as PdfText, StyleSheet } from '@react-pdf/renderer'
import type { ReactNode } from 'react'

const T = PdfText as React.ComponentType<{
  style?: object
  children?: ReactNode
  fixed?: boolean
  render?: (props: { pageNumber: number; totalPages: number }) => string
}>

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#0f172a',
    color: '#f1f5f9',
    padding: 48,
    fontFamily: 'Helvetica',
    fontSize: 12,
  },
  coverTitle: { fontSize: 36, fontFamily: 'Helvetica-Bold', color: '#f97316', marginBottom: 12 },
  coverSub: { fontSize: 20, color: '#94a3b8', marginBottom: 8 },
  coverDate: { fontSize: 12, color: '#64748b' },
  sectionTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 20, color: '#f97316' },
  statBox: { backgroundColor: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, width: '45%' },
  statValue: { fontSize: 30, fontFamily: 'Helvetica-Bold', color: '#f97316' },
  statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  rowLabel: { fontSize: 13, color: '#cbd5e1' },
  rowValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#f97316' },
  footer: { position: 'absolute', bottom: 24, left: 48, right: 48, textAlign: 'center', fontSize: 10, color: '#64748b' },
})

export interface ReportData {
  project: { name: string; description?: string | null }
  stats: { totalWelds: number; acceptedWelds: number; failedWelds: number; completionPct: number }
  weldsByStatus: { status: string; count: number }[]
  topWelders: { name: string; total: number; pass_rate: number }[]
  generatedAt: string
  organizationName?: string
}

export function ExecutiveReport({ data }: { data: ReportData }) {
  return (
    <Document title={`${data.project.name} — Executive Report`} author="PipeField OS">
      {/* Cover page */}
      <Page size="A4" style={styles.page}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <T style={{ fontSize: 11, color: '#94a3b8', marginBottom: 24, letterSpacing: 2 }}>
            EXECUTIVE HANDOVER REPORT
          </T>
          <T style={styles.coverTitle}>{data.project.name}</T>
          {data.project.description ? (
            <T style={{ fontSize: 14, color: '#94a3b8', marginBottom: 32, lineHeight: 1.6 }}>
              {data.project.description}
            </T>
          ) : null}
          <View style={{ height: 1, backgroundColor: '#334155', marginBottom: 32 }} />
          <T style={styles.coverDate}>Generated {data.generatedAt}</T>
          {data.organizationName ? (
            <T style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{data.organizationName}</T>
          ) : null}
        </View>
        <T style={styles.footer}>PipeField OS · Confidential</T>
      </Page>

      {/* Stats page */}
      <Page size="A4" style={styles.page}>
        <T style={styles.sectionTitle}>Project Summary</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {[
            { label: 'Total Welds', value: String(data.stats.totalWelds) },
            { label: 'Accepted', value: String(data.stats.acceptedWelds) },
            { label: 'Failed', value: String(data.stats.failedWelds) },
            { label: 'Completion', value: `${data.stats.completionPct}%` },
          ].map(({ label, value }) => (
            <View key={label} style={styles.statBox}>
              <T style={styles.statValue}>{value}</T>
              <T style={styles.statLabel}>{label}</T>
            </View>
          ))}
        </View>
        <T style={styles.footer}>PipeField OS · {data.project.name}</T>
      </Page>

      {/* Weld status page */}
      <Page size="A4" style={styles.page}>
        <T style={styles.sectionTitle}>Weld Status Breakdown</T>
        {data.weldsByStatus.map(({ status, count }) => (
          <View key={status} style={styles.row}>
            <T style={styles.rowLabel}>{status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</T>
            <T style={styles.rowValue}>{count}</T>
          </View>
        ))}
        <T style={styles.footer}>PipeField OS · {data.project.name}</T>
      </Page>

      {/* Top welders page */}
      <Page size="A4" style={styles.page}>
        <T style={styles.sectionTitle}>Welder Performance</T>
        <View style={styles.row}>
          <T style={{ fontSize: 11, color: '#64748b', fontFamily: 'Helvetica-Bold' }}>WELDER</T>
          <T style={{ fontSize: 11, color: '#64748b', fontFamily: 'Helvetica-Bold' }}>WELDS · PASS RATE</T>
        </View>
        {data.topWelders.map(({ name, total, pass_rate }) => (
          <View key={name} style={styles.row}>
            <T style={styles.rowLabel}>{name}</T>
            <T style={{ fontSize: 12, color: '#94a3b8' }}>{total} welds · {pass_rate}% pass</T>
          </View>
        ))}
        <T style={styles.footer}>PipeField OS · {data.project.name}</T>
      </Page>
    </Document>
  )
}
