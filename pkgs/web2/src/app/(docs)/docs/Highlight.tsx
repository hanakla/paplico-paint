'use client'

import Editor, { Monaco, OnMount } from '@monaco-editor/react'
import { parseTmTheme } from 'monaco-themes'
import { useCallback, useRef, useState } from 'react'

export function Highlight({ code, language }) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const [editorHeight, setEditorHeight] = useState<number>(100)

  const onMount = useCallback<OnMount>((editor, monaco) => {
    editorRef.current = editor
    setEditorHeight(editorRef.current?.getContentHeight() ?? 100)
    monaco.editor.defineTheme('github', parseTmTheme(theme))
    monaco.editor.setTheme('github')
  }, [])

  const onChange = useCallback((value, event) => {
    editorRef.current?.layout()
  }, [])

  return (
    <Editor
      height={editorHeight}
      value={code}
      language={language}
      theme="light"
      onMount={onMount}
      onChange={onChange}
      options={{
        readOnly: true,

        minimap: { enabled: false, showSlider: 'mouseover' },
        scrollBeyondLastColumn: 0,
        scrollBeyondLastLine: false,
        hover: { enabled: false },
        contextmenu: false,
        renderLineHighlight: 'none',
        occurrencesHighlight: false,
        scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
      }}
    />
  )
}

// FROM: https://github.com/rjfranco/monokai-light/tree/master
const theme = `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>name</key>
	<string>Monokai Light</string>
	<key>settings</key>
	<array>
		<dict>
			<key>settings</key>
			<dict>
				<key>background</key>
				<string>#FFFFFF</string>
				<key>caret</key>
				<string>#000000</string>
				<key>foreground</key>
				<string>#000000</string>
				<key>invisibles</key>
				<string>#E0E0E0</string>
				<key>lineHighlight</key>
				<string>#A5A5A526</string>
				<key>selection</key>
				<string>#C2E8FF</string>
				<key>selectionBorder</key>
				<string>#AACBDF</string>
				<key>inactiveSelection</key>
				<string>#EDEDED</string>
				<key>findHighlight</key>
				<string>#FFE792</string>
				<key>findHighlightForeground</key>
				<string>#000000</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Comment</string>
			<key>scope</key>
			<string>comment</string>
			<key>settings</key>
			<dict>
				<key>foreground</key>
				<string>#9F9F8F</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>String</string>
			<key>scope</key>
			<string>string</string>
			<key>settings</key>
			<dict>
				<key>foreground</key>
				<string>#F25A00</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Number</string>
			<key>scope</key>
			<string>constant.numeric</string>
			<key>settings</key>
			<dict>
				<key>foreground</key>
				<string>#AE81FF</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Built-in constant</string>
			<key>scope</key>
			<string>constant.language</string>
			<key>settings</key>
			<dict>
				<key>foreground</key>
				<string>#AE81FF</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>User-defined constant</string>
			<key>scope</key>
			<string>constant.character, constant.other</string>
			<key>settings</key>
			<dict>
				<key>foreground</key>
				<string>#AE81FF</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Variable</string>
			<key>scope</key>
			<string>variable</string>
			<key>settings</key>
			<dict>
				<key>fontStyle</key>
				<string></string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Keyword</string>
			<key>scope</key>
			<string>keyword</string>
			<key>settings</key>
			<dict>
				<key>foreground</key>
				<string>#F92672</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Storage</string>
			<key>scope</key>
			<string>storage</string>
			<key>settings</key>
			<dict>
				<key>fontStyle</key>
				<string></string>
				<key>foreground</key>
				<string>#F92672</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Storage type</string>
			<key>scope</key>
			<string>storage.type</string>
			<key>settings</key>
			<dict>
				<key>fontStyle</key>
				<string>italic</string>
				<key>foreground</key>
				<string>#28C6E4</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Class name</string>
			<key>scope</key>
			<string>entity.name.class</string>
			<key>settings</key>
			<dict>
				<key>fontStyle</key>
				<string>underline</string>
				<key>foreground</key>
				<string>#6AAF19</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Inherited class</string>
			<key>scope</key>
			<string>entity.other.inherited-class</string>
			<key>settings</key>
			<dict>
				<key>fontStyle</key>
				<string>italic underline</string>
				<key>foreground</key>
				<string>#6AAF19</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Function name</string>
			<key>scope</key>
			<string>entity.name.function</string>
			<key>settings</key>
			<dict>
				<key>fontStyle</key>
				<string></string>
				<key>foreground</key>
				<string>#6AAF19</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Function argument</string>
			<key>scope</key>
			<string>variable.parameter</string>
			<key>settings</key>
			<dict>
				<key>fontStyle</key>
				<string>italic</string>
				<key>foreground</key>
				<string>#FD971F</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Tag name</string>
			<key>scope</key>
			<string>entity.name.tag</string>
			<key>settings</key>
			<dict>
				<key>fontStyle</key>
				<string></string>
				<key>foreground</key>
				<string>#F92672</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Tag attribute</string>
			<key>scope</key>
			<string>entity.other.attribute-name</string>
			<key>settings</key>
			<dict>
				<key>fontStyle</key>
				<string></string>
				<key>foreground</key>
				<string>#6AAF19</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Library function</string>
			<key>scope</key>
			<string>support.function</string>
			<key>settings</key>
			<dict>
				<key>fontStyle</key>
				<string></string>
				<key>foreground</key>
				<string>#28C6E4</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Library constant</string>
			<key>scope</key>
			<string>support.constant</string>
			<key>settings</key>
			<dict>
				<key>fontStyle</key>
				<string></string>
				<key>foreground</key>
				<string>#28C6E4</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Library class/type</string>
			<key>scope</key>
			<string>support.type, support.class</string>
			<key>settings</key>
			<dict>
				<key>fontStyle</key>
				<string>italic</string>
				<key>foreground</key>
				<string>#28C6E4</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Library variable</string>
			<key>scope</key>
			<string>support.other.variable</string>
			<key>settings</key>
			<dict>
				<key>fontStyle</key>
				<string></string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Invalid</string>
			<key>scope</key>
			<string>invalid</string>
			<key>settings</key>
			<dict>
				<key>background</key>
				<string>#F92672</string>
				<key>fontStyle</key>
				<string></string>
				<key>foreground</key>
				<string>#F8F8F0</string>
			</dict>
		</dict>
		<dict>
			<key>name</key>
			<string>Invalid deprecated</string>
			<key>scope</key>
			<string>invalid.deprecated</string>
			<key>settings</key>
			<dict>
				<key>background</key>
				<string>#AE81FF</string>
				<key>foreground</key>
				<string>#F8F8F0</string>
			</dict>
		</dict>
	</array>
	<key>uuid</key>
	<string>D8D5E82E-3D5B-46B5-B38E-8C841C21347D</string>
</dict>
</plist>
`
