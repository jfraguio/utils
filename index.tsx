import React, { useState, useRef } from 'react'
import { Retool } from '@tryretool/custom-component-support'
import './file-upload.css'

export const UploadFile: React.FC = () => {
  const [tenant, _setTenant] = Retool.useStateString({ name: 'tenant' })
  const [serviceAccount, _setServiceAccount] = Retool.useStateString({ name: 'serviceAccount' })
  const [userLogin, _setUserLogin] = Retool.useStateString({ name: 'userLogin' })
  const [folder, _setFolder] = Retool.useStateString({ name: 'folder' })
  const [folderId, _setFolderId] = Retool.useStateString({ name: 'folderId' })
  const [assetId, _setAssetId] = Retool.useStateString({ name: 'assetId' })

  // Estado para almacenar el archivo seleccionado y mensajes de estado
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string>('')

  // Ref al input oculto
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Función para manejar la selección del archivo vía input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
    }
  }

  // Función para convertir el archivo a base64
  const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const base64String = reader.result.split(',')[1]
          resolve(base64String)
        } else {
          reject(new Error('Unreadable file'))
        }
      }
      reader.onerror = error => reject(error)
    })
  }

  // Función principal de subida del archivo
  const handleUpload = async () => {
    if (!file) return
    
    try {
      setStatus('Reading file...')
      const base64Data = await toBase64(file)

      const fileToUpload = {
        type: file.type,
        sizeBytes: file.size,
        name: file.name,
        base64Data: base64Data
      }

      let format: string
      switch (file.type.split('/')[0]) {
        case 'image':
          format = 'Image'
          break
        case 'video':
          format = 'Video'
          break
        default:
          format = 'Other'
      }

      const postBody: any = {
        contentType: fileToUpload.type,
        contentLength: fileToUpload.sizeBytes,
        originalAssetName: fileToUpload.name.replace(/\s+/g, ''),
        serviceAccount: serviceAccount,
        visibility: 'PUBLIC',
        tenant: tenant,
        metadata: {
          folder: 'DEFAULT',
          tenant: 'GLOBAL',
          uploader: userLogin,
          format: format
        }
      }
      if (assetId) postBody.overwrite = assetId

      setStatus('Uploading (1/1)...')
      const postResponse = await fetch('https://amanda.inditex.com/v2/signedUrl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postBody)
      })
      if (!postResponse.ok) {
        throw new Error('The upload could not be completed')
      }
      const signedUrlResult = await postResponse.json()

      const url = signedUrlResult.url
      const binaryData = Uint8Array.from(atob(fileToUpload.base64Data), c => c.charCodeAt(0))

      const headers: Record<string, string> = {
        'Content-Type': fileToUpload.type,
        'x-goog-content-length-range': `${fileToUpload.sizeBytes},${fileToUpload.sizeBytes}`,
        'x-goog-meta-sa': serviceAccount,
        'x-goog-meta-assetid': signedUrlResult.assetId,
        'x-goog-meta-originalassetname': fileToUpload.name.replace(/\s+/g, ''),
        'x-goog-meta-visibility': 'PUBLIC',
        'x-goog-meta-tenant': tenant,
        'x-goog-meta-version': '2'
      }
      if (assetId) headers['x-goog-meta-overwrite'] = assetId

      const putResponse = await fetch(url, {
        method: 'PUT',
        headers,
        body: binaryData
      })
      if (!putResponse.ok) {
        throw new Error(`La subida falló con el estado ${putResponse.status}`)
      }

      // Restauro el estado del componente
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setStatus('Upload completed successfully')
    } 
    
    catch (error: any) {
      console.error('Error subiendo archivo:', error)
      setStatus(`Error: ${error.message}`)
    }
  }

  return (
    <div style={{ position: 'relative', float: 'left', width: '100%', fontSize: '14px', overflow: 'hidden' }}>
      {/* Input oculto para abrir el selector de archivos */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Zona de drop */}
      <div
        id="drop-area"
        title="Supported fomats:
video/mp4
video/quicktime
image/gif
image/jpeg
image/png
image/svg+xml
application/pdf"
        style={{ position: 'relative', float: 'left', width: '100%', backgroundColor: '#F5F5F5', cursor: 'pointer' }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault()
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFile(e.dataTransfer.files[0])
          }
        }}
      >
        <label style={{
          position: 'relative',
          float: 'left',
          width: '100%',
          textAlign: 'center',
          marginTop: '20px',
          marginBottom: '20px',
          fontSize: '13px',
          cursor: 'pointer',
          fontFamily: 'sans-serif'
        }}>
          {file ? file.name : 'SELECT OR DRAG AND DROP'}
        </label>
      </div>

      <ul style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        listStyleType: 'none',
        margin: '0',
        padding: '12px 0 0 0'
      }}>
        <li style={{ width: '49%' }}>
          <button
            onClick={handleUpload}
            style={{
              width: '100%',
              color: 'white',
              backgroundColor: 'black',
              cursor: 'pointer',
              border: 'none',
              height: '32px',
              paddingRight: '2px'
            }}
          >
            Upload
          </button>
        </li>
        <li style={{ width: '49%' }}>
          <button
            onClick={() => {
              setFile(null)
              setStatus('')
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
            style={{
              width: '100%',
              color: '#333',
              backgroundColor: '#dbd9d7',
              cursor: 'pointer',
              border: 'none',
              height: '32px',
              paddingRight: '2px'
            }}
          >
            Cancel
          </button>
        </li>
      </ul>

      {status && <p style={{ marginTop: 10, fontStyle: 'italic', fontFamily: 'sans-serif', color:'#AAA' }}>{status}</p>}
    </div>
  )
}

export default UploadFile