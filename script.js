document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const generateBtn = document.getElementById('generate-btn');
    const skinPreviewContainer = document.getElementById('skin-preview-container');
    const skinOptionsModal = document.getElementById('skin-options-modal');
    const confirmSkinBtn = document.getElementById('confirm-skin-btn');
    const cancelSkinBtn = document.getElementById('cancel-skin-btn');
    const skinNameInput = document.getElementById('skin-name');
    const packNameInput = document.getElementById('pack-name');
    const packDescriptionInput = document.getElementById('pack-description');
    const packVersionInput = document.getElementById('pack-version');
    const loadingElement = document.getElementById('loading');

    // State
    let skins = [];
    let currentSkinData = null;

    // Event Listeners
    uploadArea.addEventListener('click', (e) => {
        if (e.target === uploadArea) {
            fileInput.click();
        }
    });

    browseBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', function(e) {
        if (this.files.length > 0) {
            handleFiles(this.files);
            this.value = '';
        }
    });

    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('drop', handleDrop);
    generateBtn.addEventListener('click', generateMcPack);
    confirmSkinBtn.addEventListener('click', confirmSkinOptions);
    cancelSkinBtn.addEventListener('click', cancelSkinOptions);

    // Functions
    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.style.backgroundColor = 'rgba(94, 124, 22, 0.3)';
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.style.backgroundColor = '';

        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    }

    function handleFiles(files) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type === 'image/png') {
                const reader = new FileReader();
                reader.onload = function(e) {
                    currentSkinData = {
                        file: file,
                        dataUrl: e.target.result
                    };
                    showSkinOptionsModal();
                };
                reader.readAsDataURL(file);
            } else {
                alert('Only PNG images are supported.');
            }
        }
    }

    function showSkinOptionsModal() {
        const originalName = currentSkinData.file.name.replace(/\.png$/i, '');
        skinNameInput.value = originalName;
        skinOptionsModal.style.display = 'flex';
    }

    function confirmSkinOptions() {
        const skinName = skinNameInput.value.trim();
        const armModel = document.querySelector('input[name="arm-model"]:checked').value;

        if (!skinName) {
            alert('Please enter a skin name');
            return;
        }

        const skin = {
            name: skinName,
            armModel: armModel,
            dataUrl: currentSkinData.dataUrl,
            fileName: `${skinName.replace(/\s+/g, '_')}_${armModel}.png`.toLowerCase()
        };

        skins.push(skin);
        renderSkinPreview(skin);
        skinOptionsModal.style.display = 'none';
    }

    function cancelSkinOptions() {
        skinOptionsModal.style.display = 'none';
    }

    function renderSkinPreview(skin) {
        const preview = document.createElement('div');
        preview.className = 'skin-preview';

        const img = document.createElement('img');
        img.src = skin.dataUrl;
        img.alt = skin.name;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'skin-name';
        nameSpan.textContent = skin.name;

        const modelSpan = document.createElement('span');
        modelSpan.className = 'arm-model';
        modelSpan.textContent = skin.armModel === 'customSlim' ? 'Slim Arms' : 'Wide Arms';

        preview.appendChild(img);
        preview.appendChild(nameSpan);
        preview.appendChild(modelSpan);

        skinPreviewContainer.appendChild(preview);
    }

    async function generateMcPack() {
        try {
            const packName = packNameInput.value.trim();
            const packDescription = packDescriptionInput.value.trim();
            const packVersion = packVersionInput.value.trim();

            if (!packName) {
                alert('Please enter a pack name');
                return;
            }

            if (!packDescription) {
                alert('Please enter a pack description');
                return;
            }

            if (!/^\d+\.\d+\.\d+$/.test(packVersion)) {
                alert('Please enter a valid version number (e.g., 1.0.0)');
                return;
            }

            if (skins.length === 0) {
                alert('Please add at least one skin');
                return;
            }

            loadingElement.style.display = 'block';
            generateBtn.disabled = true;

            await createMcPackFile(packName, packDescription, packVersion);

            loadingElement.style.display = 'none';
            generateBtn.disabled = false;

            // Reset form
            skins = [];
            skinPreviewContainer.innerHTML = '';

        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred. Please try again.');
            loadingElement.style.display = 'none';
            generateBtn.disabled = false;
        }
    }

    async function createMcPackFile(packName, packDescription, packVersion) {
        return new Promise((resolve, reject) => {
            try {
                const zip = new JSZip();
                const texturesFolder = zip.folder("textures");
                const textsFolder = zip.folder("texts");

                // Create manifest.json
                const manifest = {
                    "header": {
                        "name": packName,
                        "version": packVersion.split('.').map(Number),
                        "uuid": generateUUID()
                    },
                    "modules": [{
                        "version": packVersion.split('.').map(Number),
                        "type": "skin_pack",
                        "uuid": generateUUID()
                    }],
                    "format_version": 1
                };

                zip.file("manifest.json", JSON.stringify(manifest, null, 2));

                // Create skins.json
                const skinsJson = {
                    "skins": skins.map(skin => ({
                        "localization_name": `${skin.name}_${skin.armModel}`,
                        "geometry": `geometry.humanoid.${skin.armModel}`,
                        "texture": `textures/${skin.fileName}`,
                        "type": "free"
                    })),
                    "serialize_name": packName.replace(/\s+/g, ''),
                    "localization_name": packName.replace(/\s+/g, '')
                };

                // Add skins to textures folder
                skins.forEach(skin => {
                    const base64Data = skin.dataUrl.replace(/^data:image\/png;base64,/, '');
                    texturesFolder.file(skin.fileName, base64Data, { base64: true });
                });

                zip.file("skins.json", JSON.stringify(skinsJson, null, 2));

                // Create contents.json
                const contents = {
                    "version": 1,
                    "content": [
                        {"path": "manifest.json"},
                        {"path": "skins.json", "key": generateRandomKey()},
                        {"path": "texts/en_US.lang"},
                        {"path": "texts/languages.json"},
                        ...skins.map(skin => ({
                            "path": `textures/${skin.fileName}`,
                            "key": generateRandomKey()
                        }))
                    ]
                };

                zip.file("contents.json", JSON.stringify(contents, null, 2));

                // Create languages.json
                textsFolder.file("languages.json", JSON.stringify(["en_US"]));

                // Create en_US.lang
                let langContent = `skinpack.${packName.replace(/\s+/g, '').toLowerCase()}=${packName}\n`;
                langContent += skins.map((skin, index) =>
                    `skin.${packName.replace(/\s+/g, '').toLowerCase()}.${skin.name.replace(/\s+/g, '').toLowerCase()}_${skin.armModel}=${skin.name} ${index + 1}`
                ).join('\n');

                textsFolder.file("en_US.lang", langContent);

                // Generate and download ZIP
                zip.generateAsync({ type: 'blob' }).then(content => {
                    const url = URL.createObjectURL(content);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${packName.replace(/\s+/g, '_')}.mcpack`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        resolve();
                    }, 100);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function generateRandomKey() {
        return Array.from({length: 32}, () =>
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]
        ).join('');
    }
});