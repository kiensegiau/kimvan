import { XMarkIcon, ExclamationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export function SyncResultNotification({ syncResult, setSyncResult }) {
  if (!syncResult) return null;
  
  return (
    <div className={`bg-${syncResult.success ? 'green' : 'red'}-50 p-4 rounded-md mb-6`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {syncResult.success ? (
            <>
              {syncResult.inProgress ? (
                <ArrowPathIcon className="h-5 w-5 text-green-400 animate-spin" />
              ) : (
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </>
          ) : (
            <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
          )}
        </div>
        <div className="ml-3">
          <p className={`text-sm font-medium text-${syncResult.success ? 'green' : 'red'}-800`}>
            {syncResult.message}
          </p>
        </div>
        <div className="ml-auto pl-3">
          <div className="-mx-1.5 -my-1.5">
            <button
              onClick={() => setSyncResult(null)}
              className={`inline-flex rounded-md p-1.5 text-${syncResult.success ? 'green' : 'red'}-500 hover:bg-${syncResult.success ? 'green' : 'red'}-100`}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProcessResultNotification({ processResult, setProcessResult }) {
  if (!processResult) return null;
  
  return (
    <div className={`bg-${processResult.success ? 'purple' : 'red'}-50 p-4 rounded-md mb-6`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {processResult.success ? (
            <svg className="h-5 w-5 text-purple-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
          )}
        </div>
        <div className="ml-3">
          <p className={`text-sm font-medium text-${processResult.success ? 'purple' : 'red'}-800`}>
            {processResult.message}
          </p>
        </div>
        <div className="ml-auto pl-3">
          <div className="-mx-1.5 -my-1.5">
            <button
              onClick={() => setProcessResult(null)}
              className={`inline-flex rounded-md p-1.5 text-${processResult.success ? 'purple' : 'red'}-500 hover:bg-${processResult.success ? 'purple' : 'red'}-100`}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UploadResultNotification({ uploadResult, setUploadResult }) {
  if (!uploadResult) return null;
  
  return (
    <div className={`bg-${uploadResult.success ? 'green' : 'red'}-50 p-4 rounded-md mb-6`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {uploadResult.success ? (
            <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
          )}
        </div>
        <div className="ml-3">
          <p className={`text-sm font-medium text-${uploadResult.success ? 'green' : 'red'}-800`}>
            {uploadResult.message}
          </p>
          {uploadResult.success && uploadResult.url && (
            <div className="mt-2">
              <a 
                href={uploadResult.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                {uploadResult.filename || 'Xem file PDF đã tải lên'}
              </a>
            </div>
          )}
        </div>
        <div className="ml-auto pl-3">
          <div className="-mx-1.5 -my-1.5">
            <button
              onClick={() => setUploadResult(null)}
              className={`inline-flex rounded-md p-1.5 text-${uploadResult.success ? 'green' : 'red'}-500 hover:bg-${uploadResult.success ? 'green' : 'red'}-100`}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProcessAllDriveResultNotification({ processAllDriveResult, setProcessAllDriveResult }) {
  if (!processAllDriveResult) return null;
  
  return (
    <div className={`bg-${processAllDriveResult.success ? 'amber' : 'red'}-50 p-4 rounded-md mb-6`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {processAllDriveResult.success ? (
            <>
              {processAllDriveResult.inProgress ? (
                <ArrowPathIcon className="h-5 w-5 text-amber-400 animate-spin" />
              ) : (
                <svg className="h-5 w-5 text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </>
          ) : (
            <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
          )}
        </div>
        <div className="ml-3">
          <p className={`text-sm font-medium text-${processAllDriveResult.success ? 'amber' : 'red'}-800`}>
            {processAllDriveResult.message}
          </p>
          {processAllDriveResult.details && !processAllDriveResult.inProgress && (
            <ul className="mt-2 text-sm text-amber-700 list-disc list-inside">
              {processAllDriveResult.details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="ml-auto pl-3">
          <div className="-mx-1.5 -my-1.5">
            <button
              onClick={() => setProcessAllDriveResult(null)}
              className={`inline-flex rounded-md p-1.5 text-${processAllDriveResult.success ? 'amber' : 'red'}-500 hover:bg-${processAllDriveResult.success ? 'amber' : 'red'}-100`}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProcessAllSheetsResultNotification({ processAllSheetsResult, setProcessAllSheetsResult }) {
  if (!processAllSheetsResult) return null;
  
  return (
    <div className={`bg-${processAllSheetsResult.success ? 'blue' : 'red'}-50 p-4 rounded-md mb-6`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {processAllSheetsResult.success ? (
            <>
              {processAllSheetsResult.inProgress ? (
                <ArrowPathIcon className="h-5 w-5 text-blue-400 animate-spin" />
              ) : (
                <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </>
          ) : (
            <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
          )}
        </div>
        <div className="ml-3">
          <p className={`text-sm font-medium text-${processAllSheetsResult.success ? 'blue' : 'red'}-800`}>
            {processAllSheetsResult.message}
          </p>
          {processAllSheetsResult.results && !processAllSheetsResult.inProgress && (
            <ul className="mt-2 text-sm text-blue-700 list-disc list-inside">
              {processAllSheetsResult.results.map((result, index) => (
                <li key={index}>{result.title || result.sheetId}</li>
              ))}
            </ul>
          )}
          {processAllSheetsResult.errors && processAllSheetsResult.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-red-800">Lỗi:</p>
              <ul className="text-sm text-red-700 list-disc list-inside">
                {processAllSheetsResult.errors.map((error, index) => (
                  <li key={index}>{error.title || error.sheetId}: {error.error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="ml-auto pl-3">
          <div className="-mx-1.5 -my-1.5">
            <button
              onClick={() => setProcessAllSheetsResult(null)}
              className={`inline-flex rounded-md p-1.5 text-${processAllSheetsResult.success ? 'blue' : 'red'}-500 hover:bg-${processAllSheetsResult.success ? 'blue' : 'red'}-100`}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 