const startDate = document.getElementById("startDate");
const endDate = document.getElementById("endDate");
const totalDays = document.getElementById("totalDays");
const leaveForm = document.getElementById("leaveForm");
const leaveHistory = document.getElementById("leaveHistory");

function calculateDays() {

    if (!startDate.value || !endDate.value) {
        totalDays.textContent = "Select dates";
        return;
    }

    const start = new Date(startDate.value);
    const end = new Date(endDate.value);

    const difference = end - start;

    const days = Math.floor(
        difference / (1000 * 60 * 60 * 24)
    ) + 1;

    if (days <= 0) {
        totalDays.textContent = "Invalid dates";
        return;
    }

    totalDays.textContent = days + " Day" + (days > 1 ? "s" : "");
}

startDate.addEventListener("change", calculateDays);
endDate.addEventListener("change", calculateDays);


leaveForm.addEventListener("submit", function (event) {

    event.preventDefault();

    const type = document.getElementById("leaveType").value;
    const start = startDate.value;
    const end = endDate.value;

    if (!type || !start || !end) {
        alert("Please complete all fields.");
        return;
    }

    if (new Date(end) < new Date(start)) {
        alert("End date cannot be before start date.");
        return;
    }

    const requestedDays = totalDays.textContent;

    const newRequest = document.createElement("div");

    newRequest.className = "leave-history-row";

    newRequest.innerHTML = `
        <div class="leave-type-icon personal-icon">
            ☷
        </div>

        <div class="leave-history-info">

            <strong>${type}</strong>

            <span>${start} – ${end}</span>

        </div>

        <div class="leave-days">
            ${requestedDays}
        </div>

        <span class="status pending">
            Pending
        </span>
    `;

    leaveHistory.prepend(newRequest);

    alert("Leave request submitted successfully!");

    leaveForm.reset();

    totalDays.textContent = "Select dates";

});