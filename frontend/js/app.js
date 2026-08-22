const status = document.getElementById("attendanceStatus");

if (localStorage.getItem("dayflowCheckedIn") === "true") {
    status.textContent = "Checked in";
}