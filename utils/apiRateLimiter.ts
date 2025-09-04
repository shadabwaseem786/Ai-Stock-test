// A simple queue to manage API calls to respect rate limits.
// The Gemini free tier has a 60 RPM limit. We target a much lower rate to be safe.
const MIN_INTERVAL = 2100; // 2.1 seconds for a very safe margin (approx. 28 RPM max)

const requestQueue: Array<{
    apiCall: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
}> = [];
let isProcessing = false;

const processQueue = async () => {
    if (requestQueue.length === 0) {
        isProcessing = false;
        return;
    }

    isProcessing = true;
    const { apiCall, resolve, reject } = requestQueue.shift()!;
    
    try {
        const result = await apiCall();
        resolve(result);
    } catch (error) {
        reject(error);
    }
    
    // Wait for the interval before processing the next request in the queue.
    setTimeout(processQueue, MIN_INTERVAL);
};

/**
 * Schedules an API call to be executed in a rate-limited queue.
 * @param apiCall The function that performs the API call. It should be an async function.
 * @returns A promise that resolves with the result of the API call once it has been completed.
 */
export const scheduleApiCall = <T>(apiCall: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
        requestQueue.push({ apiCall, resolve, reject });
        if (!isProcessing) {
            processQueue();
        }
    });
};
