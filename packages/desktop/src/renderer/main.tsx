import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '../../../frontend/src/App'
import '../../../frontend/src/index.css'

/**
 * 桌面端入口文件
 * 复用frontend的App组件
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
