import { createBrowserRouter } from 'react-router';
import { CatalogDetail } from '../catalog/CatalogDetail';
import { CatalogPage } from '../catalog/CatalogPage';
import { ComingSoon } from './ComingSoon';
import { Layout } from './Layout';
import { NotFound } from './NotFound';
import { RouteError } from './RouteError';

// 화면 TASK(T27~T28)가 이 children에 경로를 추가한다
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <CatalogPage /> },
      { path: 'catalog/:catalogItemId', element: <CatalogDetail /> },
      // T27이 내 체험 화면으로, T28이 해지 브릿지 화면으로 교체한다
      {
        path: 'trials',
        element: (
          <ComingSoon
            title="내 체험 화면을 준비하고 있어요"
            detail="등록한 체험은 저장되어 있어요. 곧 이 화면에서 한눈에 볼 수 있어요."
          />
        ),
      },
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
