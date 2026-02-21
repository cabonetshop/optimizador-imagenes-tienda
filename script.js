document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let filesToProcess = [];
    let watermarkImg = null;

    // --- DOM Elements ---
    // Dropzone
    const dropzoneContent = document.querySelector('.dropzone-content');
    const fileInput = document.getElementById('file-input');
    const btnBrowse = document.getElementById('btn-browse');

    // Config
    const watermarkInput = document.getElementById('watermark-input');
    const watermarkName = document.getElementById('watermark-name');
    const usageSelect = document.getElementById('usage');
    const formatSelect = document.getElementById('format');
    const filterRadios = document.querySelectorAll('input[name="fitMode"]');
    const seoSuffixInput = document.getElementById('seo-suffix');

    // Actions & Gallery
    const btnProcess = document.getElementById('btn-process');
    const processText = document.getElementById('process-text');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const thumbnailGrid = document.getElementById('thumbnail-grid');
    const emptyState = document.getElementById('empty-state');
    const imageCount = document.getElementById('image-count');
    const btnClearAll = document.getElementById('btn-clear-all');

    // Modal & Preview
    const previewModal = document.getElementById('preview-modal');
    const previewGrid = document.getElementById('preview-grid');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnCancelDownload = document.getElementById('btn-cancel-download');
    const btnConfirmDownload = document.getElementById('btn-confirm-download');

    // State for generated details
    let pendingZip = null;
    let pendingZipName = '';
    let pendingSingleFileBlob = null;
    let pendingSingleFileName = '';

    // --- Initialization & Events ---

    // Dropzone Events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzoneContent.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzoneContent.addEventListener(eventName, () => dropzoneContent.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzoneContent.addEventListener(eventName, () => dropzoneContent.classList.remove('dragover'), false);
    });

    dropzoneContent.addEventListener('drop', handleDrop, false);
    btnBrowse.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    // Watermark Event
    watermarkInput.addEventListener('change', handleWatermarkChange);

    // Filter/Action Events
    btnClearAll.addEventListener('click', clearAllFiles);
    btnProcess.addEventListener('click', processBatch);

    // Modal Events
    btnCloseModal.addEventListener('click', closeModal);
    btnCancelDownload.addEventListener('click', closeModal);
    btnConfirmDownload.addEventListener('click', downloadZip);

    // --- Core Functions ---

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFiles(files) {
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];

        Array.from(files).forEach(file => {
            if (validTypes.includes(file.type)) {
                // Generate a unique ID for the file to handle removal easily
                file.id = Math.random().toString(36).substring(2, 9);
                filesToProcess.push(file);
                createThumbnail(file);
            }
        });

        updateUI();
    }

    function createThumbnail(file) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            const card = document.createElement('div');
            card.className = 'thumb-card';
            card.dataset.id = file.id;

            const img = document.createElement('img');
            img.src = reader.result;

            const info = document.createElement('div');
            info.className = 'thumb-info';
            info.textContent = file.name;

            const btnRemove = document.createElement('button');
            btnRemove.className = 'thumb-remove';
            btnRemove.innerHTML = '<i class="ph ph-x"></i>';
            btnRemove.title = "Eliminar";
            btnRemove.onclick = () => removeFile(file.id);

            card.appendChild(img);
            card.appendChild(info);
            card.appendChild(btnRemove);

            // Append to DOM, hide empty state
            emptyState.classList.add('hidden');
            thumbnailGrid.appendChild(card);
        };
    }

    function removeFile(id) {
        filesToProcess = filesToProcess.filter(f => f.id !== id);
        const card = document.querySelector(`.thumb-card[data-id="${id}"]`);
        if (card) {
            card.remove();
        }
        updateUI();
    }

    function clearAllFiles() {
        filesToProcess = [];
        const cards = document.querySelectorAll('.thumb-card');
        cards.forEach(card => card.remove());
        updateUI();
        fileInput.value = ''; // Reset input
    }

    function updateUI() {
        const count = filesToProcess.length;
        imageCount.textContent = count;

        if (count > 0) {
            emptyState.classList.add('hidden');
            btnProcess.disabled = false;
            btnClearAll.classList.remove('hidden');
            processText.textContent = `Procesar Lote (${count})`;
        } else {
            emptyState.classList.remove('hidden');
            btnProcess.disabled = true;
            btnClearAll.classList.add('hidden');
            processText.textContent = `Procesar Lote`;
        }
    }

    function handleWatermarkChange(e) {
        const file = e.target.files[0];
        if (file && file.type === 'image/png') {
            watermarkName.textContent = file.name;
            const reader = new FileReader();
            reader.onload = (event) => {
                watermarkImg = new Image();
                watermarkImg.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            watermarkName.textContent = "Ningún archivo seleccionado";
            watermarkImg = null;
            watermarkInput.value = ''; // Reset
        }
    }

    // --- Processing Logic ---

    function getSelectedFitMode() {
        let mode = 'cover';
        filterRadios.forEach(radio => {
            if (radio.checked) mode = radio.value;
        });
        return mode;
    }

    function cleanFilename(originalName, suffix) {
        // Remove extension
        let name = originalName.substring(0, originalName.lastIndexOf('.'));
        if (!name) name = originalName;

        // Clean: lowercase, replace spaces/special chars with hyphens
        name = name.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
            .replace(/[^a-z0-9]+/g, '-') // special chars to hyphen
            .replace(/^-+|-+$/g, ''); // trim hyphens

        // Add suffix if provided
        if (suffix && suffix.trim() !== '') {
            const cleanSuffix = suffix.trim().toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
            if (cleanSuffix) {
                name += `-${cleanSuffix}`;
            }
        }

        return name || 'imagen';
    }

    async function processBatch() {
        if (filesToProcess.length === 0) return;

        // UI Lock
        btnProcess.disabled = true;
        btnProcess.innerHTML = '<i class="ph ph-spinner ph-spin"></i><span>Procesando...</span>';
        progressContainer.classList.remove('hidden');

        const zip = new JSZip();
        pendingZip = zip; // Save reference
        const total = filesToProcess.length;

        // Settings
        const usageTarget = usageSelect.options[usageSelect.selectedIndex];
        const targetWidth = parseInt(usageTarget.dataset.width);
        const targetHeight = parseInt(usageTarget.dataset.height);
        const format = formatSelect.value;
        const fitMode = getSelectedFitMode();
        const suffix = seoSuffixInput.value;

        pendingZipName = suffix ? `imagenes_optimizadas_${suffix}.zip` : 'imagenes_optimizadas.zip';

        // Clear previous previews
        previewGrid.innerHTML = '';

        for (let i = 0; i < total; i++) {
            const file = filesToProcess[i];

            // Update Progress
            const percent = Math.round((i / total) * 100);
            progressFill.style.width = `${percent}%`;
            progressText.textContent = `Procesando ${i + 1}/${total}: ${file.name}`;

            try {
                const resultBlob = await processSingleImage(file, targetWidth, targetHeight, format, fitMode);
                const newName = `${cleanFilename(file.name, suffix)}.${format}`;

                if (total === 1) {
                    pendingSingleFileBlob = resultBlob;
                    pendingSingleFileName = newName;
                } else {
                    zip.file(newName, resultBlob);
                }

                // Add to preview
                addPreviewItem(resultBlob, newName, format, Math.round(resultBlob.size / 1024));
            } catch (err) {
                console.error(`Error procesando ${file.name}:`, err);
            }
        }

        // Processing Done - Show Modal
        progressFill.style.width = '100%';
        progressText.textContent = '¡Imágenes listas para previsualizar!';

        // Update Modal Button Text
        const btnConfirm = document.getElementById('btn-confirm-download');
        if (total === 1) {
            btnConfirm.innerHTML = '<i class="ph-bold ph-download-simple"></i> Descargar Imagen';
        } else {
            btnConfirm.innerHTML = '<i class="ph-bold ph-download-simple"></i> Descargar ZIP';
        }

        setTimeout(() => {
            progressContainer.classList.add('hidden');
            progressFill.style.width = '0%';
            btnProcess.innerHTML = '<i class="ph-bold ph-lightning"></i><span id="process-text">Procesar y Previsualizar</span>';
            updateUI();
            openModal();
        }, 800);
    }

    function addPreviewItem(blob, filename, format, sizeKb) {
        const item = document.createElement('div');
        item.className = 'preview-item';

        const img = document.createElement('img');
        const url = URL.createObjectURL(blob);
        img.src = url;

        // Revoke URL when image loads to save memory
        img.onload = () => { URL.revokeObjectURL(url); }

        const details = document.createElement('div');
        details.className = 'preview-details';

        const nameNode = document.createElement('span');
        nameNode.className = 'preview-name';
        nameNode.textContent = filename;

        const metaNode = document.createElement('div');
        metaNode.style.display = 'flex';
        metaNode.style.justifyContent = 'space-between';

        const badge = document.createElement('span');
        badge.className = 'badge-format';
        badge.textContent = format;

        const sizeNode = document.createElement('span');
        sizeNode.textContent = `${sizeKb} KB`;

        metaNode.appendChild(badge);
        metaNode.appendChild(sizeNode);

        details.appendChild(nameNode);
        details.appendChild(metaNode);

        item.appendChild(img);
        item.appendChild(details);

        previewGrid.appendChild(item);
    }

    function openModal() {
        previewModal.classList.remove('hidden');
    }

    function closeModal() {
        previewModal.classList.add('hidden');
    }

    async function downloadZip() {
        const btnConfirm = document.getElementById('btn-confirm-download');
        const isSingle = filesToProcess.length === 1;

        if (!isSingle && !pendingZip) return;
        if (isSingle && !pendingSingleFileBlob) return;

        btnConfirm.disabled = true;
        btnConfirm.innerHTML = isSingle
            ? '<i class="ph ph-spinner ph-spin"></i> Descargando...'
            : '<i class="ph ph-spinner ph-spin"></i> Empaquetando...';

        try {
            if (isSingle) {
                // Download single image directly
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = URL.createObjectURL(pendingSingleFileBlob);
                a.download = pendingSingleFileName;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(a.href);
                }, 500);
            } else {
                // Generate and download ZIP
                const zipContent = await pendingZip.generateAsync({ type: 'blob' });

                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = URL.createObjectURL(zipContent);
                a.download = pendingZipName;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(a.href);
                }, 500);
            }

            closeModal();
            // Optional: clear state after download? Or let them download multiple times
            // clearAllFiles();
        } catch (err) {
            console.error("Error en descarga:", err);
            alert("Hubo un error al procesar la descarga.");
        } finally {
            btnConfirm.disabled = false;
            btnConfirm.innerHTML = isSingle
                ? '<i class="ph-bold ph-download-simple"></i> Descargar Imagen'
                : '<i class="ph-bold ph-download-simple"></i> Descargar ZIP';
        }
    }

    function processSingleImage(file, tWidth, tHeight, format, fitMode) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();

            reader.onload = (e) => {
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = tWidth;
                    canvas.height = tHeight;
                    const ctx = canvas.getContext('2d');

                    // Background mapping
                    if (format === 'jpeg') {
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, tWidth, tHeight);
                    } else if (fitMode === 'contain') {
                        // For Png/Webp contain, explicit clear to transparent
                        ctx.clearRect(0, 0, tWidth, tHeight);
                    }

                    // Calculate dimensions
                    const sRatio = img.width / img.height;
                    const tRatio = tWidth / tHeight;
                    let drawWidth, drawHeight, offsetX, offsetY;

                    if (fitMode === 'cover') {
                        if (sRatio > tRatio) {
                            // Source is wider
                            drawHeight = tHeight;
                            drawWidth = img.width * (tHeight / img.height);
                            offsetX = (tWidth - drawWidth) / 2;
                            offsetY = 0;
                        } else {
                            // Source is taller or equal
                            drawWidth = tWidth;
                            drawHeight = img.height * (tWidth / img.width);
                            offsetX = 0;
                            offsetY = (tHeight - drawHeight) / 2;
                        }
                    } else {
                        // Contain
                        if (sRatio > tRatio) {
                            drawWidth = tWidth;
                            drawHeight = img.height * (tWidth / img.width);
                            offsetX = 0;
                            offsetY = (tHeight - drawHeight) / 2;
                        } else {
                            drawHeight = tHeight;
                            drawWidth = img.width * (tHeight / img.height);
                            offsetX = (tWidth - drawWidth) / 2;
                            offsetY = 0;
                        }
                    }

                    // Smoothing
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';

                    // Draw Image
                    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

                    // Draw Watermark
                    if (watermarkImg) {
                        ctx.globalAlpha = 0.5;
                        // Watermark size (e.g., 20% of canvas width)
                        const wmWidth = tWidth * 0.20;
                        const wRatio = watermarkImg.width / watermarkImg.height;
                        const wmHeight = wmWidth / wRatio;

                        // Bottom right padding (5% of canvas width)
                        const padding = tWidth * 0.05;
                        const wmOffsetX = tWidth - wmWidth - padding;
                        const wmOffsetY = tHeight - wmHeight - padding;

                        ctx.drawImage(watermarkImg, wmOffsetX, wmOffsetY, wmWidth, wmHeight);
                        ctx.globalAlpha = 1.0; // Reset
                    }

                    // Smart Compression Loop
                    let mimeType = 'image/jpeg';
                    if (format === 'webp') mimeType = 'image/webp';
                    if (format === 'png') mimeType = 'image/png';

                    if (format === 'png') {
                        // PNG does not support quality param in toBlob
                        canvas.toBlob(blob => resolve(blob), mimeType);
                    } else {
                        // WebP or JPEG: compress reducing quality until < 250KB or quality reaches 0.6
                        compressLoop(canvas, mimeType, 0.90, resolve, reject);
                    }
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function compressLoop(canvas, mimeType, quality, resolve, reject) {
        canvas.toBlob(blob => {
            if (!blob) {
                reject(new Error("Canvas toBlob failed"));
                return;
            }

            const MAX_SIZE = 250 * 1024; // 250 KB
            const MIN_QUALITY = 0.60;
            const STEP = 0.05;

            if (blob.size <= MAX_SIZE || quality <= MIN_QUALITY + 0.01) {
                // Done!
                resolve(blob);
            } else {
                // Reduce quality and try again
                const nextQuality = quality - STEP;
                compressLoop(canvas, mimeType, nextQuality, resolve, reject);
            }
        }, mimeType, quality);
    }
});
