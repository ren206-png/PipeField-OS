'use client'
// ============================================================
// ISO Tap-to-Calculate — Top-level wizard component
// Registered in CALCULATOR_MAP as 'iso-tap-calc' (ssr: false).
// Requires PFOS_FIELD_ISO_CALC flag ON and Field Pro plan or above.
// ============================================================
import React, { useState } from 'react'
import { ImageImportStep }    from './ImageImportStep'
import { ModeSelectStep }     from './ModeSelectStep'
import { DimensionEntryStep } from './DimensionEntryStep'
import { FittingSelectStep }  from './FittingSelectStep'
import { ResultsStep }        from './ResultsStep'
import type { CalcMode }      from './ModeSelectStep'
import type { ModeAResult, ModeBResult, BwResult, ThreadedResult } from '../engines/schemas'

type Step = 'image' | 'mode' | 'dimensions' | 'fittings' | 'results'

const STEPS: Step[] = ['image', 'mode', 'dimensions', 'fittings', 'results']

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current)
  return (
    <div className="flex gap-1 px-4 pt-3 pb-2" aria-label={`Step ${idx + 1} of ${STEPS.length}`}>
      {STEPS.map((s, i) => (
        <div
          key={s}
          className={`h-1 rounded-full flex-1 transition-colors ${i <= idx ? 'bg-blue-500' : 'bg-surface-700'}`}
        />
      ))}
    </div>
  )
}

interface ImageMeta {
  blob: Blob
  naturalWidth: number
  naturalHeight: number
  rotation: 0 | 90 | 180 | 270
}

export function IsoTapCalc() {
  const [step, setStep]         = useState<Step>('image')
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null)
  const [mode, setMode]         = useState<CalcMode | null>(null)
  const [geoResult, setGeoResult] = useState<ModeAResult | ModeBResult | null>(null)
  const [cutResult, setCutResult] = useState<BwResult | ThreadedResult | null>(null)
  const [cutSkipped, setCutSkipped] = useState(false)

  function reset() {
    setStep('image')
    setImageMeta(null)
    setMode(null)
    setGeoResult(null)
    setCutResult(null)
    setCutSkipped(false)
  }

  return (
    <div className="flex flex-col min-h-full bg-surface-950">
      <StepIndicator current={step} />

      <div className="flex-1 overflow-y-auto">
        {step === 'image' && (
          <ImageImportStep
            onImageReady={(blob, _url, naturalWidth, naturalHeight, rotation) => {
              setImageMeta({ blob, naturalWidth, naturalHeight, rotation })
              setStep('mode')
            }}
            onSkip={() => setStep('mode')}
          />
        )}

        {step === 'mode' && (
          <ModeSelectStep
            onSelect={m => { setMode(m); setStep('dimensions') }}
            onBack={() => setStep('image')}
          />
        )}

        {step === 'dimensions' && mode && (
          <DimensionEntryStep
            mode={mode}
            imageBlob={imageMeta?.blob}
            imageNaturalWidth={imageMeta?.naturalWidth}
            imageNaturalHeight={imageMeta?.naturalHeight}
            rotation={imageMeta?.rotation}
            onResult={r => { setGeoResult(r); setStep('fittings') }}
            onBack={() => setStep('mode')}
          />
        )}

        {step === 'fittings' && geoResult && (
          <FittingSelectStep
            travelMm={geoResult.travel}
            onResult={r => { setCutResult(r); setCutSkipped(false); setStep('results') }}
            onSkip={() => { setCutResult(null); setCutSkipped(true); setStep('results') }}
            onBack={() => setStep('dimensions')}
          />
        )}

        {step === 'results' && geoResult && (
          <ResultsStep
            geoResult={geoResult}
            cutResult={cutResult}
            cutSkipped={cutSkipped}
            onStartOver={reset}
          />
        )}
      </div>
    </div>
  )
}

// Default export for Next.js dynamic import
export default IsoTapCalc
