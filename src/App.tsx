import { MotionConfig } from 'framer-motion'
import { Route, Routes } from 'react-router-dom'
import Admin from '@/screens/Admin'
import Login from '@/screens/Login'
import Workspace from '@/screens/Workspace'

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/workspace" element={<Workspace />} />
      </Routes>
    </MotionConfig>
  )
}

export default App
