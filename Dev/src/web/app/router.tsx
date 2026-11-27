import { createBrowserRouter } from 'react-router';
import { AdminCatalogPage } from '../admin/AdminCatalogPage';
import { AdminItemCreatePage, AdminItemEditPage } from '../admin/AdminItemPage';
import { AdminLayout } from '../admin/AdminLayout';
import { AdminReportsPage } from '../admin/AdminReportsPage';
import { BridgePage } from '../bridge/BridgePage';
import { CatalogDetail } from '../catalog/CatalogDetail';
import { CatalogPage } from '../catalog/CatalogPage';
import { RefundTemplatePage } from '../trials/RefundTemplatePage';
import { TrialDetail } from '../trials/TrialDetail';
import { TrialsPage } from '../trials/TrialsPage';
import { Layout } from './Layout';
import { NotFound } from './NotFound';
import { RouteError } from './RouteError';

// 화면 TASK(T28 이후)가 이 children에 경로를 추가한다
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <CatalogPage /> },
      { path: 'catalog/:catalogItemId', element: <CatalogDetail /> },
      // `/trials/:id`는 BILLING_CHECK 알림의 도착지이기도 하다 (architecture §5.5)
      { path: 'trials', element: <TrialsPage /> },
      { path: 'trials/:trialRecordId', element: <TrialDetail /> },
      { path: 'trials/:trialRecordId/refund-template', element: <RefundTemplatePage /> },
      { path: 'bridge/:trialRecordId', element: <BridgePage /> },
      // 발표용 간소화(T30): 카탈로그 목록·등록·수정·게시 상태, 경로 오류 제보만 둔다
      {
        path: 'admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminCatalogPage /> },
          { path: 'catalog/new', element: <AdminItemCreatePage /> },
          { path: 'catalog/:catalogItemId', element: <AdminItemEditPage /> },
          { path: 'reports', element: <AdminReportsPage /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
