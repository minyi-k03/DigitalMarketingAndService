import { createBrowserRouter } from 'react-router';
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
      { path: '*', element: <NotFound /> },
    ],
  },
]);
