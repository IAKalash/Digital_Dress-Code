// Добавляем в самое начало файла, перед всеми существующими функциями
let selfieSegmentation = null;
let camera = null;
let isMediaPipeInitialized = false;
let currentBackgroundImage = null;
let currentBackgroundColor = null;
const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/IAKalash/Digital_Dress-Code/main/%D0%9F%D0%BE%D0%B4%D0%BB%D0%BE%D0%B6%D0%BA%D0%B8%20DION';

// Функция загрузки фонов с GitHub
async function loadBackgroundsFromGitHub() {
    try {
        console.log('Загрузка фонов с GitHub...');
        
        const backgrounds = [
            '1920х1080.png',
            '1920х1080_2.png'
        ];

        const backgroundGrid = document.getElementById('backgroundGrid');
        
        for (const bgName of backgrounds) {
            const bgUrl = `${GITHUB_BASE_URL}/${encodeURIComponent(bgName)}`;
            
            const bgItem = document.createElement('div');
            bgItem.className = 'background-item';
            bgItem.setAttribute('data-background', bgUrl);
            
            const img = document.createElement('img');
            img.src = bgUrl;
            img.alt = bgName;
            img.crossOrigin = 'anonymous';
            img.onerror = function() {
                console.error('Ошибка загрузки фона:', bgUrl);
                bgItem.style.display = 'none';
            };
            
            bgItem.appendChild(img);
            backgroundGrid.appendChild(bgItem);
        }

        // Переинициализируем обработчики для новых элементов
        initBackgroundItemHandlers();
        
        console.log('Фоны с GitHub загружены');
        
    } catch (error) {
        console.error('Ошибка загрузки фонов с GitHub:', error);
    }
}

// Функция инициализации MediaPipe (интегрируем с существующим кодом)
async function initMediaPipe() {
    try {
        console.log('Инициализация MediaPipe Selfie Segmentation...');
        
        // Проверяем, что MediaPipe загружен
        if (typeof SelfieSegmentation === 'undefined') {
            console.log('MediaPipe не загружен, ожидаем...');
            setTimeout(initMediaPipe, 1000);
            return;
        }

        // Создаем экземпляр сегментации
        selfieSegmentation = new SelfieSegmentation({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
            }
        });

        // Настройки - ВАЖНО: не используем 'effect'
        // Настройки - ИСПРАВЛЕННАЯ ВЕРСИЯ
        selfieSegmentation.setOptions({
            modelSelection: 1,
            selfieMode: true
        });

        // Подписываемся на результаты
        selfieSegmentation.onResults(onSegmentationResults);

        // Инициализация камеры
        const videoElement = document.getElementById('camera');
        const canvasElement = document.getElementById('output');
        
        // Убедимся, что canvas имеет правильные размеры
        canvasElement.width = 640;
        canvasElement.height = 480;
        
        if (typeof Camera !== 'undefined') {
            camera = new Camera(videoElement, {
                onFrame: async () => {
                    if (selfieSegmentation && videoElement.videoWidth > 0) {
                        try {
                            await selfieSegmentation.send({image: videoElement});
                        } catch (error) {
                            console.error('Ошибка обработки кадра:', error);
                        }
                    }
                },
                width: 640,
                height: 480
            });

            await camera.start();
            console.log('MediaPipe и камера инициализированы успешно');
            isMediaPipeInitialized = true;
            
            // Обновляем интерфейс
            updateUIAfterMediaPipeInit();
        } else {
            console.error('Camera utils не загружены');
        }

    } catch (error) {
        console.error('Ошибка инициализации MediaPipe:', error);
        setTimeout(initMediaPipe, 2000);
    }
}

function onSegmentationResults(results) {
    const canvasElement = document.getElementById('output');
    const ctx = canvasElement.getContext('2d');
    
    // ПОЛНОСТЬЮ очищаем canvas
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // 1. Сначала рисуем ЧЕЛОВЕКА
    ctx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    // 2. Используем маску чтобы СОХРАНИТЬ только человека
    if (results.segmentationMask) {
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(results.segmentationMask, 0, 0, canvasElement.width, canvasElement.height);
    }
    
    // 3. Теперь рисуем ФОН ПОД человеком
    ctx.globalCompositeOperation = 'destination-over';
    if (currentBackgroundImage) {
        ctx.drawImage(currentBackgroundImage, 0, 0, canvasElement.width, canvasElement.height);
    } else if (currentBackgroundColor) {
        ctx.fillStyle = currentBackgroundColor;
        ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    }
    
    // Восстанавливаем режим
    ctx.globalCompositeOperation = 'source-over';
}

// Функция обновления UI после инициализации MediaPipe
function updateUIAfterMediaPipeInit() {
    console.log('MediaPipe готов к работе');
    
    // Активируем кнопки, которые могли быть заблокированы
    const applyBtn = document.getElementById('applyBtn');
    const showDataBtn = document.getElementById('showDataBtn');
    const applyColorBtn = document.getElementById('applyColorBtn');
    const showDataColorBtn = document.getElementById('showDataColorBtn');
    
    if (applyBtn) {
        applyBtn.disabled = false;
        applyBtn.style.cursor = 'pointer';
        applyBtn.style.opacity = '1';
    }
    if (showDataBtn) {
        showDataBtn.disabled = false;
        showDataBtn.style.cursor = 'pointer';
        showDataBtn.style.opacity = '1';
    }
    if (applyColorBtn) {
        applyColorBtn.disabled = false;
        applyColorBtn.style.cursor = 'pointer';
        applyColorBtn.style.opacity = '1';
    }
    if (showDataColorBtn) {
        showDataColorBtn.disabled = false;
        showDataColorBtn.style.cursor = 'pointer';
        showDataColorBtn.style.opacity = '1';
    }
}

// Глобальные функции для применения фонов
window.applyBackground = function(backgroundSrc) {
    console.log('Применение фона:', backgroundSrc);
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
        currentBackgroundImage = img;
        currentBackgroundColor = null;
        console.log('Фон загружен для сегментации');
        
        // Показываем превью
        showPreview(backgroundSrc);
        
        // Принудительно обновляем отрисовку
        if (selfieSegmentation) {
            const videoElement = document.getElementById('camera');
            if (videoElement.videoWidth > 0) {
                selfieSegmentation.send({image: videoElement});
            }
        }
    };
    img.onerror = function() {
        console.error('Ошибка загрузки фона:', backgroundSrc);
        currentBackgroundImage = null;
        alert('Ошибка загрузки фонового изображения');
    };
    img.src = backgroundSrc;
};

window.applyColorBackground = function(color) {
    console.log('Применение цветного фона:', color);
    
    currentBackgroundColor = color;
    currentBackgroundImage = null;
    
    // Показываем превью цвета
    showColorPreview(color);
    
    // Принудительно обновляем отрисовку
    if (selfieSegmentation) {
        const videoElement = document.getElementById('camera');
        if (videoElement.videoWidth > 0) {
            selfieSegmentation.send({image: videoElement});
        }
    }
};

// Функции для превью
function showPreview(imageSrc) {
    const previewContainer = document.getElementById('previewContainer');
    const previewImage = document.getElementById('previewImage');
    
    previewImage.src = imageSrc;
    previewContainer.style.display = 'block';
}

function showColorPreview(color) {
    const previewContainer = document.getElementById('previewContainer');
    const previewImage = document.getElementById('previewImage');
    
    // Создаем временный canvas для отображения цвета
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 200;
    tempCanvas.height = 150;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = color;
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    previewImage.src = tempCanvas.toDataURL();
    previewContainer.style.display = 'block';
}

// Функция применения фона с данными сотрудника
window.applyBackgroundWithData = async function(backgroundSrc) {
    if (!window.employeeInstance) {
        document.getElementById('noDataNotification').style.display = 'block';
        return;
    }
    
    try {
        const backgroundWithData = await generateBackground(backgroundSrc, true);
        if (backgroundWithData) {
            window.applyBackground(backgroundWithData);
        }
    } catch (error) {
        console.error('Ошибка генерации фона с данными:', error);
    }
};

// Функция применения цветного фона с данными сотрудника
window.applyColorBackgroundWithData = async function(color) {
    if (!window.employeeInstance) {
        document.getElementById('noDataNotification').style.display = 'block';
        return;
    }
    
    try {
        // Создаем временный canvas для цветного фона
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 1920;
        tempCanvas.height = 1080;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.fillStyle = color;
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        const backgroundWithData = await generateBackground(tempCanvas.toDataURL(), true);
        if (backgroundWithData) {
            window.applyBackground(backgroundWithData);
        }
    } catch (error) {
        console.error('Ошибка генерации цветного фона с данными:', error);
    }
};

// Функция для принудительной перезагрузки MediaPipe
window.reloadMediaPipe = function() {
    if (camera) {
        camera.stop();
        camera = null;
    }
    if (selfieSegmentation) {
        selfieSegmentation.close();
        selfieSegmentation = null;
    }
    isMediaPipeInitialized = false;
    currentBackgroundImage = null;
    currentBackgroundColor = null;
    
    setTimeout(initMediaPipe, 500);
};

// Инициализация обработчиков для фоновых элементов
function initBackgroundItemHandlers() {
    // Обработчики для фоновых изображений
    document.querySelectorAll('.background-item').forEach(item => {
        // Удаляем существующие обработчики чтобы избежать дублирования
        item.replaceWith(item.cloneNode(true));
    });

    // Добавляем обработчики заново
    document.querySelectorAll('.background-item').forEach(item => {
        item.addEventListener('click', function() {
            // Убираем активный класс у всех
            document.querySelectorAll('.background-item').forEach(i => i.classList.remove('active'));
            // Добавляем активный класс текущему
            this.classList.add('active');
        });
    });
}

// Инициализация обработчиков кнопок
function initButtonHandlers() {
    initBackgroundItemHandlers();
    
    // Кнопка применения фона
    document.getElementById('applyBtn').addEventListener('click', function() {
        const activeBg = document.querySelector('.background-item.active');
        if (activeBg) {
            const backgroundSrc = activeBg.getAttribute('data-background');
            window.applyBackground(backgroundSrc);
        } else {
            alert('Выберите фон из списка');
        }
    });
    
    // Кнопка отображения данных
    document.getElementById('showDataBtn').addEventListener('click', function() {
        const activeBg = document.querySelector('.background-item.active');
        if (activeBg) {
            const backgroundSrc = activeBg.getAttribute('data-background');
            window.applyBackgroundWithData(backgroundSrc);
        } else {
            alert('Выберите фон из списка');
        }
    });
    
    // Пользовательский фон
    document.getElementById('loadCustomBackground').addEventListener('click', function() {
        const customUrl = document.getElementById('customBackgroundInput').value;
        if (customUrl) {
            window.applyBackground(customUrl);
        } else {
            alert('Введите ссылку на изображение');
        }
    });
    
    // Обработчики для цветов
    document.querySelectorAll('.color-item').forEach(item => {
        item.addEventListener('click', function() {
            // Убираем активный класс у всех
            document.querySelectorAll('.color-item').forEach(i => i.classList.remove('active'));
            // Добавляем активный класс текущему
            this.classList.add('active');
        });
    });
    
    // Кнопка применения цветного фона
    document.getElementById('applyColorBtn').addEventListener('click', function() {
        const activeColor = document.querySelector('.color-item.active');
        if (activeColor) {
            const color = activeColor.getAttribute('data-color');
            window.applyColorBackground(color);
        } else {
            const customColor = document.getElementById('customColorPicker').value;
            window.applyColorBackground(customColor);
        }
    });
    
    // Кнопка отображения данных на цветном фоне
    document.getElementById('showDataColorBtn').addEventListener('click', function() {
        const activeColor = document.querySelector('.color-item.active');
        if (activeColor) {
            const color = activeColor.getAttribute('data-color');
            window.applyColorBackgroundWithData(color);
        } else {
            const customColor = document.getElementById('customColorPicker').value;
            window.applyColorBackgroundWithData(customColor);
        }
    });
    
    // Переключение панелей
    document.getElementById('panelToggle').addEventListener('click', function() {
        const backgroundPanel = document.getElementById('backgroundPanel');
        const colorPanel = document.getElementById('colorPanel');
        
        if (backgroundPanel.style.display !== 'none') {
            backgroundPanel.style.display = 'none';
            colorPanel.style.display = 'block';
            this.textContent = '🖼️';
        } else {
            backgroundPanel.style.display = 'block';
            colorPanel.style.display = 'none';
            this.textContent = '🎨';
        }
    });
    
    // Закрытие уведомления
    document.getElementById('closeNotification').addEventListener('click', function() {
        document.getElementById('noDataNotification').style.display = 'none';
    });
}

// Глобальная функция для проверки статуса
window.getMediaPipeStatus = function() {
    return {
        initialized: isMediaPipeInitialized,
        segmentation: !!selfieSegmentation,
        camera: !!camera,
        hasBackground: !!(currentBackgroundImage || currentBackgroundColor),
        videoReady: document.getElementById('camera').videoWidth > 0
    };
};

// Добавляем глобальную функцию для принудительной перезагрузки фонов
window.reloadGitHubBackgrounds = function() {
    const backgroundGrid = document.getElementById('backgroundGrid');
    // Очищаем только динамически добавленные фоны (сохраняем оригинальные если есть)
    const dynamicItems = backgroundGrid.querySelectorAll('.background-item[data-background*="github"]');
    dynamicItems.forEach(item => item.remove());
    
    loadBackgroundsFromGitHub();
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, проверяем MediaPipe...');
    
    // Сначала загружаем фоны с GitHub
    loadBackgroundsFromGitHub();
    
    // Затем инициализируем обработчики событий для кнопок
    initButtonHandlers();
    
    // Ждем немного для загрузки всех скриптов
    setTimeout(() => {
        if (typeof SelfieSegmentation !== 'undefined' && typeof Camera !== 'undefined') {
            console.log('MediaPipe обнаружен, инициализируем...');
            initMediaPipe();
        } else {
            console.log('MediaPipe не обнаружен, запускаем загрузку...');
            // Используем существующую функцию из HTML
            if (typeof loadMediaPipe === 'function') {
                loadMediaPipe();
            }
            // Пробуем инициализировать через 2 секунды
            setTimeout(initMediaPipe, 2000);
        }
    }, 1000);
});