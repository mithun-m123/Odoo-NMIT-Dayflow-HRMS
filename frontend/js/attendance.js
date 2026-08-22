const checkInBtn = document.getElementById("checkInBtn");
const breakBtn = document.getElementById("breakBtn");
const checkOutBtn = document.getElementById("checkOutBtn");

const workTimer = document.getElementById("workTimer");
const breakTimeDisplay = document.getElementById("breakTime");

const checkInTimeDisplay = document.getElementById("checkInTime");

const workStatus = document.getElementById("workStatus");
const attendanceStatus = document.getElementById("attendanceStatus");

const timerCircle = document.getElementById("timerCircle");

const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");

const attendanceHistory =
    document.getElementById("attendanceHistory");

const toast = document.getElementById("toast");


let workInterval;
let breakInterval;


/* ---------------- LIVE CLOCK ---------------- */

function updateClock() {

    const now = new Date();

    document.getElementById("liveClock").textContent =
        now.toLocaleTimeString();
}

updateClock();

setInterval(updateClock, 1000);


/* ---------------- FORMAT TIME ---------------- */

function formatTime(seconds) {

    const hours =
        String(Math.floor(seconds / 3600))
        .padStart(2, "0");

    const minutes =
        String(Math.floor((seconds % 3600) / 60))
        .padStart(2, "0");

    const secs =
        String(seconds % 60)
        .padStart(2, "0");

    return `${hours}:${minutes}:${secs}`;
}


/* ---------------- TOAST ---------------- */

function showToast(message) {

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {

        toast.classList.remove("show");

    }, 3000);
}


/* ---------------- HISTORY ---------------- */

function addHistory(activity, status) {

    const empty =
        attendanceHistory.querySelector("td[colspan]");

    if (empty) {

        attendanceHistory.innerHTML = "";
    }

    const now = new Date();

    const time =
        now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });

    const row =
        document.createElement("tr");

    row.innerHTML = `

        <td>${activity}</td>

        <td>${time}</td>

        <td>
            <span class="status ${status === "Completed" ? "approved" : "pending"}">
                ${status}
            </span>
        </td>

    `;

    attendanceHistory.prepend(row);
}


/* ---------------- UPDATE WORK TIMER ---------------- */

function updateWorkTimer() {

    if (
        localStorage.getItem("dayflowAttendanceStatus")
        !== "working"
    ) {
        return;
    }

    const startTime =
        Number(
            localStorage.getItem("dayflowStartTime")
        );

    const totalBreak =
        Number(
            localStorage.getItem("dayflowTotalBreak")
        ) || 0;

    const now = Date.now();

    const workedSeconds =
        Math.floor(
            (now - startTime) / 1000
        ) - totalBreak;


    workTimer.textContent =
        formatTime(workedSeconds);


    /* PROGRESS */

    const goalSeconds = 8 * 60 * 60;

    let percentage =
        (workedSeconds / goalSeconds) * 100;

    if (percentage > 100) {
        percentage = 100;
    }

    progressFill.style.width =
        percentage + "%";

    progressText.textContent =
        Math.floor(percentage) + "%";


    /* TIMER CIRCLE */

    const degree =
        percentage * 3.6;

    timerCircle.style.background =

        `conic-gradient(
            #635bff ${degree}deg,
            #8b5cf6 ${degree + 20}deg,
            #ecebff ${degree + 20}deg
        )`;
}


/* ---------------- UPDATE BREAK TIMER ---------------- */

function updateBreakTimer() {

    if (
        localStorage.getItem("dayflowAttendanceStatus")
        !== "break"
    ) {
        return;
    }

    const breakStart =
        Number(
            localStorage.getItem("dayflowBreakStart")
        );

    const previousBreak =
        Number(
            localStorage.getItem("dayflowTotalBreak")
        ) || 0;

    const currentBreak =
        previousBreak +
        Math.floor(
            (Date.now() - breakStart) / 1000
        );

    breakTimeDisplay.textContent =
        formatTime(currentBreak);
}


/* ---------------- CHECK IN ---------------- */

checkInBtn.addEventListener("click", function () {

    const now = Date.now();

    localStorage.setItem(
        "dayflowStartTime",
        now
    );

    localStorage.setItem(
        "dayflowTotalBreak",
        0
    );

    localStorage.setItem(
        "dayflowAttendanceStatus",
        "working"
    );

    const time =
        new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });

    localStorage.setItem(
        "dayflowCheckInTime",
        time
    );

    checkInTimeDisplay.textContent =
        time;

    attendanceStatus.textContent =
        "WORKING NOW";

    attendanceStatus.className =
        "attendance-status status-working";

    workStatus.textContent =
        "Working";

    checkInBtn.disabled = true;

    breakBtn.disabled = false;

    checkOutBtn.disabled = false;


    addHistory(
        "Checked In",
        "Completed"
    );


    clearInterval(workInterval);

    workInterval =
        setInterval(
            updateWorkTimer,
            1000
        );

    updateWorkTimer();

    showToast(
        "🎉 Checked in successfully!"
    );

});


/* ---------------- BREAK ---------------- */

breakBtn.addEventListener("click", function () {

    const currentStatus =
        localStorage.getItem(
            "dayflowAttendanceStatus"
        );


    /* START BREAK */

    if (currentStatus === "working") {

        localStorage.setItem(
            "dayflowAttendanceStatus",
            "break"
        );

        localStorage.setItem(
            "dayflowBreakStart",
            Date.now()
        );

        clearInterval(workInterval);

        breakBtn.textContent =
            "▶ End Break";

        attendanceStatus.textContent =
            "ON BREAK";

        attendanceStatus.className =
            "attendance-status status-break";

        workStatus.textContent =
            "On Break";


        addHistory(
            "Break Started",
            "Break"
        );


        breakInterval =
            setInterval(
                updateBreakTimer,
                1000
            );

        showToast(
            "☕ Enjoy your break!"
        );
    }


    /* END BREAK */

    else if (currentStatus === "break") {

        const breakStart =
            Number(
                localStorage.getItem(
                    "dayflowBreakStart"
                )
            );

        const previousBreak =
            Number(
                localStorage.getItem(
                    "dayflowTotalBreak"
                )
            ) || 0;

        const breakDuration =
            Math.floor(
                (Date.now() - breakStart)
                / 1000
            );


        localStorage.setItem(
            "dayflowTotalBreak",
            previousBreak + breakDuration
        );

        localStorage.setItem(
            "dayflowAttendanceStatus",
            "working"
        );

        clearInterval(breakInterval);

        breakBtn.textContent =
            "☕ Start Break";


        attendanceStatus.textContent =
            "WORKING NOW";

        attendanceStatus.className =
            "attendance-status status-working";


        workStatus.textContent =
            "Working";


        addHistory(
            "Break Ended",
            "Completed"
        );


        clearInterval(workInterval);

        workInterval =
            setInterval(
                updateWorkTimer,
                1000
            );

        updateWorkTimer();

        showToast(
            "🚀 Back to work!"
        );
    }

});


/* ---------------- CHECK OUT ---------------- */

checkOutBtn.addEventListener("click", function () {

    const status =
        localStorage.getItem(
            "dayflowAttendanceStatus"
        );


    if (status === "break") {

        showToast(
            "Please end your break before checking out."
        );

        return;
    }


    localStorage.setItem(
        "dayflowAttendanceStatus",
        "completed"
    );


    clearInterval(workInterval);


    attendanceStatus.textContent =
        "WORKDAY COMPLETED";

    attendanceStatus.className =
        "attendance-status status-completed";


    workStatus.textContent =
        "Completed";


    breakBtn.disabled = true;

    checkOutBtn.disabled = true;


    addHistory(
        "Checked Out",
        "Completed"
    );


    showToast(
        "🎉 Great work! See you tomorrow."
    );

});


/* ---------------- RESTORE DATA AFTER REFRESH ---------------- */

function restoreAttendance() {

    const status =
        localStorage.getItem(
            "dayflowAttendanceStatus"
        );


    const savedCheckIn =
        localStorage.getItem(
            "dayflowCheckInTime"
        );


    if (savedCheckIn) {

        checkInTimeDisplay.textContent =
            savedCheckIn;
    }


    const savedBreak =
        Number(
            localStorage.getItem(
                "dayflowTotalBreak"
            )
        ) || 0;


    breakTimeDisplay.textContent =
        formatTime(savedBreak);


    if (status === "working") {

        attendanceStatus.textContent =
            "WORKING NOW";

        attendanceStatus.className =
            "attendance-status status-working";

        workStatus.textContent =
            "Working";

        checkInBtn.disabled = true;

        breakBtn.disabled = false;

        checkOutBtn.disabled = false;

        workInterval =
            setInterval(
                updateWorkTimer,
                1000
            );

        updateWorkTimer();
    }


    else if (status === "break") {

        attendanceStatus.textContent =
            "ON BREAK";

        attendanceStatus.className =
            "attendance-status status-break";

        workStatus.textContent =
            "On Break";

        checkInBtn.disabled = true;

        breakBtn.disabled = false;

        breakBtn.textContent =
            "▶ End Break";

        checkOutBtn.disabled = false;

        breakInterval =
            setInterval(
                updateBreakTimer,
                1000
            );

        updateBreakTimer();
    }


    else if (status === "completed") {

        attendanceStatus.textContent =
            "WORKDAY COMPLETED";

        attendanceStatus.className =
            "attendance-status status-completed";

        workStatus.textContent =
            "Completed";

        checkInBtn.disabled = true;

        breakBtn.disabled = true;

        checkOutBtn.disabled = true;

        updateWorkTimer();
    }

}


restoreAttendance();