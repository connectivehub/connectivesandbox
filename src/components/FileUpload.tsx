// Registry entry for intake component type "file_upload". Phase 3 fills in
// behaviour; this phase ships the typed props contract and a placeholder.

import type { IntakeComponent } from '@/engine/types'

export type FileUploadComponent = Extract<IntakeComponent, { type: 'file_upload' }>

export interface FileUploadProps {
  component: FileUploadComponent
  disabled?: boolean
}

export default function FileUpload(_props: FileUploadProps) {
  return (
    <div data-intake="file_upload">
      <p>file_upload intake is not implemented yet (Phase 3).</p>
    </div>
  )
}
