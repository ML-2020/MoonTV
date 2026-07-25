'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('页面渲染错误:', error);
  }, [error]);

  return (
    <div className='min-h-screen flex items-center justify-center bg-white dark:bg-black px-4'>
      <div className='text-center max-w-md'>
        <div className='text-6xl mb-4'>😵</div>
        <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200 mb-2'>
          页面加载出错
        </h2>
        <p className='text-sm text-gray-500 dark:text-gray-400 mb-6'>
          请尝试刷新页面，或返回首页重新操作。
        </p>
        <div className='flex gap-3 justify-center'>
          <button
            onClick={reset}
            className='px-5 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors'
          >
            重试
          </button>
          <a
            href='/'
            className='px-5 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
          >
            返回首页
          </a>
        </div>
      </div>
    </div>
  );
}
