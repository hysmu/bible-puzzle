// 전역 변수 window.bibleData 사용

let currentData = [];
let totalPieces = 0;
let placedPieces = 0;
let timerInterval = null;
let elapsedTime = 0;
let currentBookRangeKey = "";
let wrongAttempts = new Set();
let currentUtterance = null; // Prevent garbage collection on iOS
let autoScrollInterval = null; // For mobile auto-scroll

const puzzleBoard = document.getElementById('puzzle-board');
const piecesPool = document.getElementById('pieces-pool');
const progressText = document.getElementById('progress-text');
const startBtn = document.getElementById('start-btn');
const testamentSelect = document.getElementById('testament-select');
const bookSelect = document.getElementById('book-select');
const rangeSelect = document.getElementById('range-select');
const successModal = document.getElementById('success-modal');
const restartBtn = document.getElementById('restart-btn');
const timerText = document.getElementById('timer-text');
const bestRecordText = document.getElementById('best-record-text');
const ttsToggle = document.getElementById('tts-toggle');
const finalTime = document.getElementById('final-time');
const newRecordMsg = document.getElementById('new-record-msg');

const hintBtn = document.getElementById('hint-btn');
const reviewBtn = document.getElementById('review-btn');
const reviewModal = document.getElementById('review-modal');
const closeReviewBtn = document.getElementById('close-review-btn');
const closeSuccessBtn = document.getElementById('close-success-btn');
const reviewList = document.getElementById('review-list');

closeSuccessBtn.addEventListener('click', () => {
    successModal.classList.add('hidden');
});
restartBtn.addEventListener('click', () => {
    successModal.classList.add('hidden');
    reviewModal.classList.add('hidden');
    primeTTS(); // Unlock TTS for iOS
    initGame();
});

startBtn.addEventListener('click', () => {
    primeTTS(); // Unlock TTS for iOS
    initGame();
});

function primeTTS() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const silent = new SpeechSynthesisUtterance('');
        window.speechSynthesis.speak(silent);
        if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
        }
    }
}

hintBtn.addEventListener('click', () => {
    const remainingPieces = Array.from(piecesPool.children);
    if (remainingPieces.length === 0) return;
    
    const randomPiece = remainingPieces[Math.floor(Math.random() * remainingPieces.length)];
    const chapter = randomPiece.dataset.chapter;
    const targetSlot = Array.from(puzzleBoard.children).find(s => s.dataset.chapter === chapter);
    
    if (targetSlot) {
        randomPiece.classList.add('hint-flash');
        targetSlot.classList.add('hint-flash');
        setTimeout(() => {
            randomPiece.classList.remove('hint-flash');
            targetSlot.classList.remove('hint-flash');
        }, 2000);
    }
});

reviewBtn.addEventListener('click', () => {
    reviewList.innerHTML = '';
    const sortedWrongs = Array.from(wrongAttempts).sort((a,b) => a - b);
    
    sortedWrongs.forEach(chap => {
        const itemData = currentData.find(d => d.chapter === chap);
        if (itemData) {
            const li = document.createElement('li');
            li.innerHTML = `<span class="chapter">${itemData.chapter}장</span><span class="title">${itemData.title}</span>`;
            reviewList.appendChild(li);
        }
    });
    reviewModal.classList.remove('hidden');
});

closeReviewBtn.addEventListener('click', () => {
    reviewModal.classList.add('hidden');
});

function initGame() {
    const bookId = bookSelect.value;
    const rangeVal = rangeSelect.value;
    if (!rangeVal) {
        puzzleBoard.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #7f8c8d; font-size: 1.2rem; margin-top: 2rem;">해당 성경의 데이터가 준비되지 않았습니다.</p>';
        piecesPool.innerHTML = '';
        progressText.textContent = '0 / 0';
        stopTimer();
        timerText.textContent = '00:00';
        bestRecordText.textContent = '없음';
        return;
    }
    const [startChap, endChap] = rangeVal.split('-').map(Number);
    currentBookRangeKey = `bible_puzzle_best_${bookId}_${rangeVal}`;
    loadBestRecord();
    
    // Find book data
    const book = window.bibleData.books.find(b => b.id === bookId);
    if (!book) return;
    
    // Convert titles to chapter objects
    const startOffset = book.startChapter || 1;
    const chaptersData = (book.titles || []).map((t, index) => {
        let title = t;
        let summary = "";
        if (t && t.includes('|')) {
            const parts = t.split('|');
            title = parts[0].trim();
            summary = parts.slice(1).join('|').trim();
        }
        return {
            chapter: startOffset + index,
            title: title,
            summary: summary
        };
    });
    
    // Filter chapters
    currentData = chaptersData.filter(c => c.chapter >= startChap && c.chapter <= endChap);
    
    totalPieces = currentData.length;
    placedPieces = 0;
    wrongAttempts.clear();
    reviewBtn.style.display = 'none';
    
    adjustSizes(totalPieces);
    updateProgress();
    
    renderBoard();
    renderPieces();
    startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    elapsedTime = 0;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        elapsedTime++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function updateTimerDisplay() {
    if (!timerText) return;
    const m = String(Math.floor(elapsedTime / 60)).padStart(2, '0');
    const s = String(elapsedTime % 60).padStart(2, '0');
    timerText.textContent = `${m}:${s}`;
}

function loadBestRecord() {
    if (!bestRecordText) return;
    const record = localStorage.getItem(currentBookRangeKey);
    if (record) {
        const m = String(Math.floor(record / 60)).padStart(2, '0');
        const s = String(record % 60).padStart(2, '0');
        bestRecordText.textContent = `${m}:${s}`;
    } else {
        bestRecordText.textContent = "없음";
    }
}

function checkAndSaveBestRecord() {
    const record = localStorage.getItem(currentBookRangeKey);
    const formattedTime = timerText ? timerText.textContent : "00:00";
    if (finalTime) finalTime.textContent = formattedTime;
    
    if (!record || elapsedTime < parseInt(record)) {
        localStorage.setItem(currentBookRangeKey, elapsedTime);
        if (newRecordMsg) newRecordMsg.style.display = 'block';
        loadBestRecord();
    } else {
        if (newRecordMsg) newRecordMsg.style.display = 'none';
    }
}

function adjustSizes(total) {
    const root = document.documentElement;
    const isMobile = window.innerWidth <= 768;
    
    if (total <= 10) {
        root.style.setProperty('--item-min-width', isMobile ? '70px' : '140px');
        root.style.setProperty('--item-height', isMobile ? '80px' : '140px');
        root.style.setProperty('--piece-font-size', isMobile ? '0.8rem' : '1.1rem');
        root.style.setProperty('--chapter-font-size', isMobile ? '1.8rem' : '2.5rem');
        root.style.setProperty('--piece-padding', isMobile ? '0.4rem' : '1rem');
    } else if (total <= 20) {
        root.style.setProperty('--item-min-width', isMobile ? '70px' : '110px');
        root.style.setProperty('--item-height', isMobile ? '75px' : '110px');
        root.style.setProperty('--piece-font-size', isMobile ? '0.75rem' : '1rem');
        root.style.setProperty('--chapter-font-size', isMobile ? '1.5rem' : '2rem');
        root.style.setProperty('--piece-padding', isMobile ? '0.3rem' : '0.8rem');
    } else if (total <= 30) {
        root.style.setProperty('--item-min-width', isMobile ? '65px' : '90px');
        root.style.setProperty('--item-height', isMobile ? '70px' : '90px');
        root.style.setProperty('--piece-font-size', isMobile ? '0.7rem' : '0.85rem');
        root.style.setProperty('--chapter-font-size', isMobile ? '1.2rem' : '1.5rem');
        root.style.setProperty('--piece-padding', isMobile ? '0.2rem' : '0.6rem');
    } else {
        root.style.setProperty('--item-min-width', isMobile ? '60px' : '75px');
        root.style.setProperty('--item-height', isMobile ? '65px' : '75px');
        root.style.setProperty('--piece-font-size', isMobile ? '0.6rem' : '0.7rem');
        root.style.setProperty('--chapter-font-size', isMobile ? '1rem' : '1.2rem');
        root.style.setProperty('--piece-padding', isMobile ? '0.1rem' : '0.4rem');
    }
}

function updateProgress() {
    progressText.textContent = `${placedPieces} / ${totalPieces}`;
    if (totalPieces > 0 && placedPieces === totalPieces) {
        stopTimer();
        checkAndSaveBestRecord();
        
        if (wrongAttempts.size > 0) {
            reviewBtn.style.display = 'block';
        } else {
            reviewBtn.style.display = 'none';
        }
        
        setTimeout(() => {
            successModal.classList.remove('hidden');
            resetModalPosition(successModal);
        }, 500);
    }
}

function resetModalPosition(modal) {
    const content = modal.querySelector('.modal-content');
    if (content) {
        content.style.left = '';
        content.style.top = '';
        content.style.transform = '';
    }
}

function renderBoard() {
    puzzleBoard.innerHTML = '';
    currentData.forEach(item => {
        const slot = document.createElement('div');
        slot.classList.add('slot');
        slot.dataset.chapter = item.chapter;
        
        const numberSpan = document.createElement('span');
        numberSpan.classList.add('chapter-number');
        numberSpan.textContent = item.chapter;
        slot.appendChild(numberSpan);
        
        // Setup drop events
        slot.addEventListener('dragover', dragOver);
        slot.addEventListener('dragleave', dragLeave);
        slot.addEventListener('drop', drop);
        
        puzzleBoard.appendChild(slot);
    });
}

function renderPieces() {
    piecesPool.innerHTML = '';
    // Shuffle pieces
    const shuffledData = [...currentData].sort(() => Math.random() - 0.5);
    
    shuffledData.forEach(item => {
        const piece = document.createElement('div');
        piece.classList.add('piece');
        piece.draggable = true;
        piece.dataset.chapter = item.chapter;
        piece.textContent = item.title;
        
        // Setup drag events
        piece.addEventListener('dragstart', dragStart);
        piece.addEventListener('dragend', dragEnd);
        
        // Support touch devices (basic)
        piece.addEventListener('touchstart', touchStart, {passive: false});
        piece.addEventListener('touchmove', touchMove, {passive: false});
        piece.addEventListener('touchend', touchEnd);
        
        piecesPool.appendChild(piece);
    });
}

// Drag and Drop Handlers
let draggedPiece = null;

function dragStart(e) {
    draggedPiece = this;
    setTimeout(() => this.classList.add('dragging'), 0);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.chapter);
}

function dragEnd(e) {
    this.classList.remove('dragging');
    draggedPiece = null;
}

function dragOver(e) {
    e.preventDefault(); // Necessary to allow dropping
    if (!this.classList.contains('filled')) {
        this.classList.add('drag-over');
        e.dataTransfer.dropEffect = 'move';
    }
}

function dragLeave(e) {
    this.classList.remove('drag-over');
}

function drop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    if (this.classList.contains('filled')) return;
    
    const draggedChapter = e.dataTransfer.getData('text/plain');
    const slotChapter = this.dataset.chapter;
    
    if (draggedChapter === slotChapter) {
        // Correct match
        this.appendChild(draggedPiece);
        this.classList.add('filled');
        this.classList.add('flash');
        
        const matchedData = currentData.find(c => c.chapter == slotChapter);
        if (matchedData && matchedData.summary) {
            this.classList.add('tooltip');
            this.setAttribute('data-tooltip', matchedData.summary);
        }
        
        playSuccessSound();
        speakChapterTitle(draggedPiece.textContent);
        
        // Remove draggable property from piece
        draggedPiece.draggable = false;
        
        placedPieces++;
        updateProgress();
    } else {
        // Wrong match - visually indicate rejection
        playFailSound();
        wrongAttempts.add(parseInt(draggedChapter));
        const originalBg = this.style.backgroundColor;
        this.style.backgroundColor = '#f8d7da';
        setTimeout(() => {
            this.style.backgroundColor = originalBg;
        }, 300);
    }
}

// Basic Touch Support for mobile (Drag and Drop is not natively supported on touch)
let touchTarget = null;
let touchOffsetX = 0;
let touchOffsetY = 0;
let originalContainer = null;

function touchStart(e) {
    if (this.draggable === false) return;
    e.preventDefault();
    touchTarget = this;
    originalContainer = this.parentNode;
    
    const touch = e.touches[0];
    const rect = touchTarget.getBoundingClientRect();
    touchOffsetX = touch.clientX - rect.left;
    touchOffsetY = touch.clientY - rect.top;
    
    touchTarget.style.position = 'fixed';
    touchTarget.style.zIndex = 1000;
    touchTarget.style.left = (touch.clientX - touchOffsetX) + 'px';
    touchTarget.style.top = (touch.clientY - touchOffsetY) + 'px';
    touchTarget.style.width = rect.width + 'px';
    touchTarget.style.height = rect.height + 'px';
    touchTarget.classList.add('dragging');
}

function touchMove(e) {
    if (!touchTarget) return;
    e.preventDefault();
    const touch = e.touches[0];
    touchTarget.style.left = (touch.clientX - touchOffsetX) + 'px';
    touchTarget.style.top = (touch.clientY - touchOffsetY) + 'px';
    
    // Auto-scroll logic for mobile
    const threshold = 80; // pixels from top/bottom
    if (touch.clientY < threshold) {
        startAutoScroll('up');
    } else if (touch.clientY > window.innerHeight - threshold) {
        startAutoScroll('down');
    } else {
        stopAutoScroll();
    }
}

function startAutoScroll(direction) {
    if (autoScrollInterval) return;
    const scrollStep = 10;
    autoScrollInterval = setInterval(() => {
        window.scrollBy(0, direction === 'up' ? -scrollStep : scrollStep);
    }, 16); // ~60fps
}

function stopAutoScroll() {
    if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
    }
}

function touchEnd(e) {
    if (!touchTarget) return;
    stopAutoScroll(); // Ensure scroll stops
    e.preventDefault();
    touchTarget.style.position = '';
    touchTarget.style.zIndex = '';
    touchTarget.style.left = '';
    touchTarget.style.top = '';
    touchTarget.style.width = '';
    touchTarget.style.height = '';
    touchTarget.classList.remove('dragging');
    
    const touch = e.changedTouches[0];
    const elementsBelow = document.elementsFromPoint(touch.clientX, touch.clientY);
    const slot = elementsBelow.find(el => el.classList.contains('slot') && !el.classList.contains('filled'));
    
    if (slot) {
        const slotChapter = slot.dataset.chapter;
        const pieceChapter = touchTarget.dataset.chapter;
        
        if (slotChapter === pieceChapter) {
            slot.appendChild(touchTarget);
            slot.classList.add('filled');
            slot.classList.add('flash');
            
            const matchedData = currentData.find(c => c.chapter == slotChapter);
            if (matchedData && matchedData.summary) {
                slot.classList.add('tooltip');
                slot.setAttribute('data-tooltip', matchedData.summary);
            }
            
            playSuccessSound();
            speakChapterTitle(touchTarget.textContent);
            touchTarget.draggable = false;
            touchTarget.style.position = 'relative'; // reset
            
            placedPieces++;
            updateProgress();
        } else {
            // wrong, goes back to original pool
            playFailSound();
            wrongAttempts.add(parseInt(pieceChapter));
            originalContainer.appendChild(touchTarget);
            const originalBg = slot.style.backgroundColor;
            slot.style.backgroundColor = '#f8d7da';
            setTimeout(() => {
                slot.style.backgroundColor = originalBg;
            }, 300);
        }
    } else {
        originalContainer.appendChild(touchTarget);
    }
    
    touchTarget = null;
    originalContainer = null;
}

// Sound Effects (Web Audio API)
function playSuccessSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch(e) {}
}

function speakChapterTitle(titleText) {
    if (ttsToggle && ttsToggle.checked && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        
        // Use global variable to prevent garbage collection on some browsers
        currentUtterance = new SpeechSynthesisUtterance(titleText);
        currentUtterance.lang = 'ko-KR';
        currentUtterance.rate = 1.0;
        
        // Some iOS versions require resume()
        if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
        }
        
        window.speechSynthesis.speak(currentUtterance);
    }
}

function playFailSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    } catch(e) {}
}

// Dynamic Dropdowns
function initDropdowns() {
    populateBooks();
    testamentSelect.addEventListener('change', populateBooks);
    bookSelect.addEventListener('change', populateRanges);
}

function populateBooks() {
    const testament = testamentSelect.value;
    bookSelect.innerHTML = '';
    const books = window.bibleData.books.filter(b => b.testament === testament);
    if (books.length === 0) {
        bookSelect.innerHTML = '<option value="">준비 중</option>';
        rangeSelect.innerHTML = '';
        return;
    }
    books.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        bookSelect.appendChild(opt);
    });
    populateRanges();
}

function populateRanges() {
    const bookId = bookSelect.value;
    const book = window.bibleData.books.find(b => b.id === bookId);
    rangeSelect.innerHTML = '';
    if (!book) return;
    
    const startOffset = book.startChapter || 1;
    const total = (book.titles || []).length;
    if (total === 0) {
        rangeSelect.innerHTML = '<option value="">데이터 준비 중</option>';
        return;
    }
    
    const endOffset = startOffset + total - 1;
    let html = '';
    for(let i=0; i<total; i+=10) {
        const start = startOffset + i;
        const end = Math.min(start + 9, endOffset);
        html += `<option value="${start}-${end}">${start}장 ~ ${end}장 (${end-start+1}개)</option>`;
    }
    for(let i=0; i<total; i+=20) {
        if(total <= 10) break;
        const start = startOffset + i;
        const end = Math.min(start + 19, endOffset);
        html += `<option value="${start}-${end}">${start}장 ~ ${end}장 (${end-start+1}개)</option>`;
    }
    if (total > 20) {
        html += `<option value="${startOffset}-${endOffset}">전체 ${startOffset}장 ~ ${endOffset}장 (${total}개)</option>`;
    }
    rangeSelect.innerHTML = html;
}

// Initialize on load
initDropdowns();
initGame();

// --- Data Editor Logic ---
const openEditorBtn = document.getElementById('open-editor-btn');
const editorModal = document.getElementById('editor-modal');
const closeEditorBtn = document.getElementById('close-editor-btn');
const editTestamentSelect = document.getElementById('edit-testament-select');
const editBookSelect = document.getElementById('edit-book-select');
const editTextArea = document.getElementById('edit-textarea');
const copyDataBtn = document.getElementById('copy-data-btn');

openEditorBtn.addEventListener('click', () => {
    editorModal.classList.remove('hidden');
    populateEditBooks();
});

closeEditorBtn.addEventListener('click', () => {
    editorModal.classList.add('hidden');
});

editTestamentSelect.addEventListener('change', populateEditBooks);
editBookSelect.addEventListener('change', loadBookData);

function populateEditBooks() {
    const testament = editTestamentSelect.value;
    editBookSelect.innerHTML = '';
    const books = window.bibleData.books.filter(b => b.testament === testament);
    books.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        editBookSelect.appendChild(opt);
    });
    loadBookData();
}

function loadBookData() {
    const bookId = editBookSelect.value;
    const book = window.bibleData.books.find(b => b.id === bookId);
    if (book && book.titles) {
        editTextArea.value = book.titles.join('\n');
    } else {
        editTextArea.value = '';
    }
}

copyDataBtn.addEventListener('click', () => {
    const bookId = editBookSelect.value;
    const book = window.bibleData.books.find(b => b.id === bookId);
    if (!book) return;

    // Update book titles from textarea
    const newTitles = editTextArea.value.split('\n').map(t => t.trim()).filter(t => t !== '');
    book.titles = newTitles;

    // Generate JSON string for data.js
    let output = "window.bibleData = {\n  books: [\n";
    const bookStrings = window.bibleData.books.map(b => {
        let str = `    { id: "${b.id}", name: "${b.name}", testament: "${b.testament}"`;
        if (b.startChapter) {
            str += `, startChapter: ${b.startChapter}`;
        }
        if (b.titles && b.titles.length > 0) {
            str += `,\n      titles: [\n        "` + b.titles.join(`",\n        "`) + `"\n      ]`;
        } else {
            str += `, titles: []`;
        }
        str += ` }`;
        return str;
    });
    output += bookStrings.join(",\n");
    output += "\n  ]\n};\n";

    // Copy to clipboard
    navigator.clipboard.writeText(output).then(() => {
        alert("데이터가 업데이트되고 전체 코드가 클립보드에 복사되었습니다!\n\n에디터의 data.js 파일 내용을 모두 지우고 붙여넣기(Ctrl+V) 하세요.");
    }).catch(err => {
        alert("클립보드 복사에 실패했습니다. 콘솔을 확인해주세요.");
        console.error("Clipboard error:", err);
    });
});

// --- Draggable Modal Logic ---
function makeDraggable(modalId) {
    const modal = document.getElementById(modalId);
    const content = modal.querySelector('.modal-content');
    const header = content.querySelector('h2'); // Drag by the title
    
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        
        // Get current position
        const rect = content.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        
        content.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const x = e.clientX - offsetX;
        const y = e.clientY - offsetY;
        
        content.style.left = x + 'px';
        content.style.top = y + 'px';
        content.style.transform = 'none'; // Disable the centering transform while dragging
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        content.style.cursor = '';
    });
}

// Apply draggable logic to modals
makeDraggable('success-modal');
