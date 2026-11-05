import { createBrowserRouter } from 'react-router';
import { Home } from './Home';
import { Layout } from './Layout';
import { NotFound } from './NotFound';
import { RouteError } from './RouteError';

// 화면 TASK(T26~T28)가 이 children에 경로를 추가한다
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
