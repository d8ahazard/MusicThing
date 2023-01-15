const num_notes = 12;
const num_inst = 6;
let num_rows = num_inst;
let num_cols = num_notes;
let keyDownListener = null;
let keyUpListener = null;
let currentInstrument = 0;
let numMeasures = 1;
let currentTempo = 60;
let minTempo = 20;
let maxTempo = 240;
let currentStep = 0;
let totalSteps = (60000 / currentTempo / 16) * numMeasures;

let is_recording = false;
let is_metronome = false;
let is_playing = true;

let samples = {};

let playNotes = {};
let recNotes = {};
let held_notes = [];
let activeNotes = [];
// All notes to start will a howl created and put here.
let startNotes = {};
// Each loop we take everything in startNotes, start it, and move it here.
let startedNotes = {};
// If a note stop is triggered, we add it to this array, call stop, and then clear stopNotes.
let stopNotes = {};
let tickSound;
let lastTimestamp = Date.now();

let defaultSamples = [
    "00_00.mp3",
    "00_01.mp3",
    "00_02.mp3",
    "00_03.mp3",
    "00_04.mp3",
    "00_05.mp3",
    "00_06.mp3",
    "00_07.mp3",
    "00_08.mp3",
    "00_09.mp3",
    "01_00.mp3",
    "01_01.mp3",
    "01_02.mp3",
    "01_03.mp3",
    "01_04.mp3",
    "01_05.mp3",
    "01_06.mp3",
    "01_07.mp3",
    "01_08.mp3",
    "01_09.mp3",
    "02_00.mp3",
    "02_01.mp3",
    "02_02.mp3",
    "02_03.mp3",
    "02_04.mp3",
    "02_05.mp3",
    "02_06.mp3",
    "02_07.mp3",
    "02_08.mp3",
    "02_09.mp3",
    "03_00.mp3",
    "03_01.mp3",
    "03_02.mp3",
    "03_03.mp3",
    "03_04.mp3",
    "03_05.mp3",
    "03_06.mp3",
    "03_07.mp3",
    "03_08.mp3",
    "03_09.mp3",
    "04_00.mp3",
    "04_01.mp3",
    "04_02.mp3",
    "04_03.mp3",
    "04_04.mp3",
    "04_05.mp3",
    "04_06.mp3",
    "04_07.mp3",
    "04_08.mp3",
    "04_09.mp3",
    "metronome.mp3"
]

function runLoop(){
    let frequency = 60000 / currentTempo / 16;
    totalSteps = (60000 / currentTempo / 16) * numMeasures;
    let currentTimestamp = Date.now();
    if(currentTimestamp - lastTimestamp > frequency){
        // Only run the "play things" loop if we're playing.
        if (currentStep % 8 === 0 && is_metronome) {
                playMetronome();
            }
            internalTimer();
        currentStep += 1;
        if (currentStep >= totalSteps) currentStep = 0;
        lastTimestamp = currentTimestamp;
    }
    requestAnimationFrame(runLoop);
}

function loadDefaultSamples() {
    defaultSamples.forEach(function(sample_name){
        let full_path = `./samples/${sample_name}`;
        if (sample_name.indexOf("_") !== -1) {
            let parts = sample_name.split("_");
            let row = parseInt(parts[0]);
            let column = parseInt(parts[1].split(".")[0]);
            console.log("Row: " + row + ", Column: " + column);
            samples[`${row}-${column}`] = full_path;
        }
        if (sample_name.indexOf("metronome") !== -1) {
            samples["metronome"] = full_path;
        }
    });
    console.log("Loaded samples: ", samples);
}

function internalTimer() {
    let newPlayNotes = playNotes[currentStep] || [];
    let newRecNotes = recNotes[currentStep] || [];
    let newNotes = newPlayNotes.concat(newRecNotes);
    let notesToRemove = activeNotes.filter(note => !newNotes.includes(note));
    if (is_recording) {
        held_notes.forEach(noteIndex => recordNote(noteIndex));
    }
    // call function for new notes
    newNotes.forEach(note => {
        if (!activeNotes.includes(note)) {
            triggerNote(note);
            activeNotes.push(note);
        }
    });

    // call function for notes to remove
    notesToRemove.forEach(note => {
        endNote(note);
        activeNotes.splice(activeNotes.indexOf(note), 1);
    });

    for (const [idx, to_play] of Object.entries(startNotes)) {
        console.log("Play sound: ", idx);
        to_play.play();
    }
    startedNotes = [startNotes, startedNotes].reduce(function (r, o) {
        Object.keys(o).forEach(function (k) { r[k] = o[k]; });
        return r;
    }, {});

    startNotes = {};

    for (const [idx, to_stop] of Object.entries(stopNotes)) {
        to_stop.stop();
    }
    stopNotes = {};
}

function triggerNote(noteIdx) {
    let e_id = `note${noteIdx}`;
    let noteDiv = document.getElementById(e_id);
    if (noteDiv !== null && noteDiv !== undefined) {
        playNote(noteDiv);

    }
}

function endNote(noteIdx) {
    let noteDiv = document.getElementById(`note${noteIdx}`);
    if (noteDiv !== null && noteDiv !== undefined) clearNote(noteDiv);
}


// Make our grid of buttons
function makeGrid() {
    let screenWidth = window.innerWidth;
    let screenHeight = window.innerHeight;
    // Create the container element
    let container;
    container = document.getElementById("noteContainer");
    if (container) {
        container.innerHTML = "";
    } else {
        container = document.createElement("div");
        container.classList.add("text-center", "note-container");
        container.id = "noteContainer";
    }


    // Determine the number of rows and columns based on the screen resolution
    let rows, columns;
    if (screenWidth > screenHeight) {
        rows = num_inst;
        columns = num_notes;
    } else {
        rows = num_notes;
        columns = num_inst;
    }
    num_rows = rows;
    num_cols = columns;
    // Set the size of the rows and columns based on the screen size
    let vSize = ((screenWidth - 2) / columns);
    let hSize = ((screenHeight - 2) / rows);
    let size = Math.min(vSize, hSize) + "px";

// Create the rows
    for (let i = 0; i < rows; i++) {
        let row = document.createElement("div");
        row.classList.add("noteRow");
        row.id = `row${i}`;
        row.style.height = size;
        row.style.width = "100%";
        // Create the columns
        for (let j = 0; j < columns; j++) {
            let col = document.createElement("div");
            col.classList.add("noteCol", `note${j}`, `row${i}`);
            col.id = `note${i}-${j}`;
            // Append the container to the body
            col.style.height = size;
            col.style.width = size;
            row.appendChild(col);
        }
        container.appendChild(row);
    }

    document.body.prepend(container);
    let noteCols = document.getElementsByClassName("noteCol");
    for (let i = 0; i < noteCols.length; i++) {
        noteCols[i].addEventListener("mousedown", function(event) { playNote(event.target, true); });
        noteCols[i].addEventListener("mouseup", function(event) { clearNote(event.target, true); });
        noteCols[i].addEventListener("touchstart", function(event) { playNote(event.target, true); });
        noteCols[i].addEventListener("touchend", function(event) { clearNote(event.target, true); });
    }
}

// Bind keyboard keys to notes
function createKeyboardControls() {
    // Create a dictionary of keycode-index pairs
    let keyCodeIndex = {
        "KeyW": 0, // w
        "Digit3": 1, // 3
        "KeyE": 2, // e
        "Digit4": 3, // 4
        "KeyR": 4, // r
        "KeyT": 5, // t
        "Digit6": 6, // 6
        "KeyY": 7, // y
        "Digit7": 8, // 7
        "KeyU": 9, // u
        "Digit8": 10, // 8
        "KeyI": 11, // i
        "KeyO": 12 // o
    };
    console.log("Created controls.")
    // Get the resolution of the screen
    let resolution = window.innerWidth > window.innerHeight ? "landscape" : "portrait";

    // Add keydown event listener
    keyDownListener = document.addEventListener("keydown", function(event) {
        let keyCode = event.code;
        if (keyCode in keyCodeIndex) {
            let col = resolution === "landscape" ? keyCodeIndex[keyCode] : currentInstrument;
            let row = resolution === "landscape" ? currentInstrument : keyCodeIndex[keyCode];
            // Find the corresponding element in the grid using the index
            let element = document.getElementById(`note${row}-${col}`);
            if (element && ! element.classList.contains("heldNote")) {
                console.log("Playing: ", element);
                playNote(element, true);
            }
            // Add code here to perform actions on the element
        }
    });

    keyUpListener = document.addEventListener("keyup", function(event) {
        let keyCode = event.code;
        if (keyCode in keyCodeIndex) {
            let col = resolution === "landscape" ? keyCodeIndex[keyCode] : currentInstrument;
            let row = resolution === "landscape" ? currentInstrument : keyCodeIndex[keyCode];
            // Find the corresponding element in the grid using the index
            let element = document.getElementById(`note${row}-${col}`)
            if (element && element.classList.contains("heldNote")) {
                console.log("Clearing: ", element);
                clearNote(element, true);
            }
            // Add code here to perform actions on the element
        }
    });
}

// Create UI controls to do the things
function createControls() {

    let controls = document.getElementById("controls");
    let controlsSet = false;
    if (controls === null || controls === undefined) {
        controls = document.createElement("div");
        controls.id = "controls";
    } else {
        controlsSet = true;
    }
    // Check screen orientation and add appropriate class
    if(window.innerHeight > window.innerWidth) {
        controls.classList.remove("topbar");
        controls.classList.add("sidebar");
    } else {
        controls.classList.remove("sidebar");
        controls.classList.add("topbar");
    }
    // Create the main div container
    if (controlsSet) return;

    // Create the buttons
    let buttonNames = ["metronome", "play", "back", "forward", "copy", "paste", "clear", "record"];
    let buttonIcons = ["metronome", "play", "rewind", "fast-forward", "content-copy", "content-paste", "delete", "record"];
    for(let i = 0; i < buttonNames.length; i++) {
        let button = document.createElement("div");
        button.id = buttonNames[i];
        if (button.id === "play") {
            button.classList.add("active");
        }
        button.classList.add("ctrlBtn", "mdi", "mdi-" + buttonIcons[i]);
        button.addEventListener("click", function() {
            window[this.id]();
        });
        controls.appendChild(button);
    }

    // Append the main div container to the body
    document.body.appendChild(controls);
}

// Set listeners to make up/down keys adjust the selected instrument
function setInstrumentSwitcher() {
    document.addEventListener("keydown", function(event) {
  if (event.code === "ArrowUp") {
    currentInstrument = currentInstrument - 1;
  } else if (event.code === "ArrowDown") {
    currentInstrument = currentInstrument + 1;
  } else if (event.code === "ArrowRight") {
      currentTempo = Math.min(currentTempo + 1, maxTempo);
  } else if (event.code === "ArrowLeft") {
      currentTempo = Math.max(currentTempo - 1, minTempo);
  }
  currentInstrument = currentInstrument < 0 ? num_inst - 1 : currentInstrument >= num_inst ? 0 : currentInstrument;
});
}

// Create empty functions for each button
function metronome() {
    let self = document.getElementById("metronome");
    if (is_metronome) {
        self.classList.remove("active");
        is_metronome = false;
        if (tickSound) {
            tickSound.stop();
        }
    } else {
        self.classList.add("active");
        is_metronome = true;
    }
}
function play() {
    let self = document.getElementById("play");
    if (is_playing) {
        self.classList.remove("active");
        is_playing = false;
    } else {
        self.classList.add("active");
        is_playing = true;
    }
}
function back() {}
function forward() {}
function copy() {}
function paste() {}
function clear() {
    if (confirm("This will reset everything. Continue?")) {
        playNotes = {};
        recNotes = {};
        held_notes = [];
        activeNotes = [];
        // All notes to start will a howl created and put here.
        startNotes = {};
        // Each loop we take everything in startNotes, start it, and move it here.
        startedNotes = {};
        // If a note stop is triggered, we add it to this array, call stop, and then clear stopNotes.
        stopNotes = {};
    }
}
function record() {
    let self = document.getElementById("record");
    if (is_recording) {
        self.classList.remove("active");
        is_recording = false;
    } else {
        self.classList.add("active");
        is_recording = true;
    }
}


document.addEventListener("DOMContentLoaded", function () {
    makeGrid();
    createControls();
    createKeyboardControls(0);
    setInstrumentSwitcher();
    requestAnimationFrame(runLoop);
    loadDefaultSamples();
});

window.addEventListener("resize", function () {
    makeGrid();
    createControls();

});





//Function to find adjacent elements
function findAdjacentElements(clickedElement, existingElements) {
    if (clickedElement === null || clickedElement === undefined) return [];
    let elementRow = parseInt(clickedElement.className.match(/row(\d+)/)[1]);
    let noteIndex = parseInt(clickedElement.className.match(/note(\d+)/)[1]);
    let nextElements = [];

    // Check top row
    if (elementRow > 0) {
        for (let i = noteIndex - 1; i <= noteIndex + 1; i++) {
            if (i >= 0 && i < 12) {
                let topElement = document.querySelector(`.note${i}.row${elementRow - 1}`);
                if (!existingElements.includes(topElement) && !nextElements.includes(topElement)) {
                    nextElements.push(topElement);
                }
            }
        }
    }
    // Check left and right
    if (noteIndex > 0) {
        let leftElement = document.querySelector(`.note${noteIndex - 1}.row${elementRow}`);
        if (!existingElements.includes(leftElement) && !nextElements.includes(leftElement)) {
            nextElements.push(leftElement);
        }
    }
    if (noteIndex < 12) {
        let rightElement = document.querySelector(`.note${noteIndex + 1}.row${elementRow}`);
        if (!existingElements.includes(rightElement) && !nextElements.includes(rightElement)) {
            nextElements.push(rightElement);
        }
    }
    // Check bottom row
    if (elementRow < 8) {
        for (let i = noteIndex - 1; i <= noteIndex + 1; i++) {
            if (i >= 0 && i < 12) {
                let bottomElement = document.querySelector(`.note${i}.row${elementRow + 1}`);
                if (!existingElements.includes(bottomElement) && !nextElements.includes(bottomElement)) {
                    nextElements.push(bottomElement);
                }
            }
        }
    }
    return nextElements.filter(function(element) {
        return element !== null && element !== undefined;
    });
}

let noteColors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff"];

function recordNote(noteIdx) {
    if (!(currentStep in recNotes)) {
        recNotes[currentStep] = [noteIdx];
    } else {
        if(!recNotes[currentStep].includes(noteIdx)) {
            recNotes[currentStep].push(noteIdx);
        }
    }
}

function playMetronome() {
    console.log("Tick");
    if (tickSound === null || tickSound === undefined) {
        tickSound  =new Howl({
            src: [samples["metronome"]]
        });
    }
    tickSound.stop();
    tickSound.play();
}

function playNote(clickedElement, is_event=false) {
    // Get the clicked element
    if (!clickedElement.classList) {
        console.log("NOCLASS", clickedElement);
        return;
    }

    let note_idx = clickedElement.id.replace("note", "");

    if (is_event === true && is_recording) {
        if (!held_notes.includes(note_idx)) {
            held_notes.push(note_idx);
        }
    }

    if (clickedElement.classList.contains("heldNote")) {
        return;
    }

    if (note_idx in samples) {
        if (!(note_idx in startNotes) && !(note_idx in startedNotes)) {
            let sound = new Howl({
                src: [samples[note_idx]]
            });
            sound.on('end', function(){
                console.log('Finished!');
                endNote(note_idx);
            });
            console.log("Adding note: ", note_idx);
            startNotes[note_idx] = sound;
        }
    }


    // Set the background color of the clicked element to a random color from the "noteColors" array
    let randomColor = noteColors[Math.floor(Math.random() * noteColors.length)];

    // Set the background color of the clicked element
    clickedElement.style.backgroundColor = randomColor;
    clickedElement.classList.add('heldNote');
    // Find all adjacent elements
    let existingElements = [clickedElement];
    for (let i = 0; i < 2; i++) {
        let nextElements = [];
        for(let k = 0; k < existingElements.length; k++) {
            nextElements = nextElements.concat(findAdjacentElements(existingElements[k], existingElements));
        }
        // Set the background color of the adjacent elements
        for (let j = 0; j < nextElements.length; j++) {
            if (i === 0 && j === 0) {
                randomColor = darkenColor(randomColor, 0.50);
            }
            nextElements[j].style.backgroundColor = randomColor;
            nextElements[j].classList.add("heldNote");
        }

    // Update existing elements to include the newly found elements
    existingElements = existingElements.concat(nextElements);
        randomColor = darkenColor(randomColor, 0.50);
        // Wait before continuing the loop
        setTimeout(function() {}, 100);
    }
}


function clearNote(clickedElement, is_event = false) {
    if (!clickedElement.classList) {
        return;
    }
    if (!clickedElement.classList.contains("heldNote")) {
        return;
    }

    let note_idx = clickedElement.id.replace("note", "");

    if (is_event === true && is_recording) {
        let index = held_notes.indexOf(note_idx);
        if (index !== -1) {
          held_notes.splice(index, 1);
        }
    }
    if (note_idx in samples) {
        let stopNote;
        if (!(note_idx in stopNotes)) {
            if (note_idx in startedNotes) {
                stopNote = startedNotes[note_idx];
                delete startedNotes[note_idx];
            }
            if (note_idx in startNotes) {
                stopNote = startNotes[note_idx];
                delete startNotes[note_idx];
            }
            if (stopNote) stopNotes[note_idx] = stopNote;
        }

    }
    clickedElement.classList.remove('heldNote');
    // Find all adjacent elements
    let existingElements = [clickedElement];
    for (let i = 0; i < 2; i++) {
        let nextElements = [];
        for(let k = 0; k < existingElements.length; k++) {
            nextElements = nextElements.concat(findAdjacentElements(existingElements[k], existingElements));
        }
        // Set the background color of the adjacent elements
        for (let j = 0; j < nextElements.length; j++) {
            if (nextElements[j]) nextElements[j].classList.remove("heldNote");
        }

        // Update existing elements to include the newly found elements
        existingElements = existingElements.concat(nextElements);
    }

    for (let i = 0; i < existingElements.length; i++) {
        existingElements[i].style.backgroundColor = "";
    }
}

function darkenColor(color, percent) {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = Math.round((R * (1 - percent))).toString(16);
    G = Math.round((G * (1 - percent))).toString(16);
    B = Math.round((B * (1 - percent))).toString(16);

    R = R.length === 1 ? "0" + R : R;
    G = G.length === 1 ? "0" + G : G;
    B = B.length === 1 ? "0" + B : B;

    return "#" + R + G + B;
}

