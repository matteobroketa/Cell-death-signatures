let globalDragProtectionApplied = false;

export function attachUploadInteractions(
  dropZoneSelector: string,
  fileInputSelector: string,
  onFile: (file: File) => Promise<void>,
): void {
  const dropZone = document.querySelector<HTMLElement>(dropZoneSelector);
  const fileInput = document.querySelector<HTMLInputElement>(fileInputSelector);

  if (!dropZone || !fileInput) {
    return;
  }

  if (!globalDragProtectionApplied) {
    const preventDocumentDrop = (event: DragEvent): void => {
      event.preventDefault();
    };

    window.addEventListener('dragover', preventDocumentDrop);
    window.addEventListener('drop', preventDocumentDrop);
    globalDragProtectionApplied = true;
  }

  const pickFirstFile = async (fileList: FileList | null): Promise<void> => {
    const file = fileList?.[0];
    if (file) {
      await onFile(file);
    }
  };

  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', async (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragover');
    await pickFirstFile(event.dataTransfer?.files ?? null);
  });

  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
}
