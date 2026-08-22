const loginPage = document.getElementById("loginPage");
const dashboard = document.getElementById("dashboard");

const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");


loginForm.addEventListener("submit", function(event) {

    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (email === "" || password === "") {
        alert("Please enter your login details.");
        return;
    }

    loginPage.classList.add("hidden");
    dashboard.classList.remove("hidden");

});


logoutBtn.addEventListener("click", function() {

    dashboard.classList.add("hidden");
    loginPage.classList.remove("hidden");

    loginForm.reset();

});