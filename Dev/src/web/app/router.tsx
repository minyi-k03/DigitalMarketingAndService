import { createBrowserRouter } from 'react-router';
import { CatalogDetail } from '../catalog/CatalogDetail';
import { CatalogPage } from '../catalog/CatalogPage';
import { TrialDetail } from '../trials/TrialDetail';
import { TrialsPage } from '../trials/TrialsPage';
import { ComingSoon } from './ComingSoon';
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
      // T28이 해지 브릿지 화면으로 교체한다
      {
        path: 'bridge/:trialRecordId',
        element: (
          <ComingSoon
            title="해지 안내 화면을 준비하고 있어요"
            detail="추적은 시작됐어요. 해지 안내는 곧 이 화면에서 볼 수 있어요."
          />
        ),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
