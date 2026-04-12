

/**
 * Open a file picker and return the selected File object
 * @param accept - MIME type or file extension pattern (e.g., 'image/*', '.png,.jpg')
 * @param multiple - Whether to allow multiple file selection
 * @returns Promise<File[]> - Array of selected files
 */
export const openFilePicker = (accept = 'image/*', multiple = false): Promise<File[]> => {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.multiple = multiple;

        input.onchange = (event) => {
            const files = Array.from((event.target as HTMLInputElement).files || []);
            if (files.length > 0) {
                resolve(files);
            } else {
                reject(new Error('No file selected'));
            }
        };

        input.oncancel = () => {
            reject(new Error('File selection cancelled'));
        };

        // Trigger click to open file picker
        input.click();
    });
};