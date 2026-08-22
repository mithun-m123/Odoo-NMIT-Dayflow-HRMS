const timer = document.getElementById("timer");
const checkOutBtn = document.getElementById("checkOutBtn");

const checkoutTime = document.getElementById("checkoutTime");
const todayCheckout = document.getElementById("todayCheckout");
const todayHours = document.getElementById("todayHours");

let seconds = 4 * 60 * 60 + 38 * 60 + 20;

let checkedOut = false;


function updateTimer() {

    if (checkedOut) return;

    seconds++;

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    timer.textContent =
        String(hours).padStart(2, "0") + ":" +
        String(minutes).padStart(2, "0") + ":" +
        String(secs).padStart(2, "0");
}


setInterval(updateTimer, 1000);


checkOutBtn.addEventListener("click", function () {

    if (checkedOut) return;

    checkedOut = true;

    const now = new Date();

    const time = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    checkoutTime.textContent = time;

    todayCheckout.textContent = time;

    todayHours.textContent =
        hours + "h " + minutes + "m";

    checkOutBtn.textContent = "✓ Checked Out";

    alert("Successfully checked out at " + time);

});