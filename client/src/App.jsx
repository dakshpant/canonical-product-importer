import { Navigate, Route, Routes } from 'react-router'

import Layout from './components/layout/Layout.jsx'
import ImportPage from './pages/ImportPage.jsx'
import ImportSummaryPage from './pages/ImportSummaryPage.jsx'
import ImportsPage from './pages/ImportsPage.jsx'
import ProductReviewPage from './pages/ProductReviewPage.jsx'
import ProductsPage from './pages/ProductsPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/products" replace />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="imports" element={<ImportsPage />} />
        <Route path="imports/:batchId" element={<ImportSummaryPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:productId" element={<ProductReviewPage />} />
        <Route path="*" element={<Navigate to="/products" replace />} />
      </Route>
    </Routes>
  )
}
