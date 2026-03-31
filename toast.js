const toastContainer = document.getElementById("toastContainer");

function showToast(message, type = "info", duration = 4000) {
  if (!toastContainer) return;

  let icon = "fa-info-circle";
  if (type === "success") icon = "fa-check-circle";
  if (type === "error") icon = "fa-exclamation-circle";
  if (type === "warning") icon = "fa-exclamation-triangle";

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <div class="toast-content">${message}</div>
        <button class="toast-close" onclick="this.parentElement.classList.add('hiding'); setTimeout(() => this.parentElement.remove(), 300)">
            <i class="fas fa-times"></i>
        </button>
    `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add("hiding");
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }
  }, duration);
}

window.showSuccess = (msg) => showToast(msg, "success");
window.showError = (msg) => showToast(msg, "error");
window.showInfo = (msg) => showToast(msg, "info");
window.showWarning = (msg) => showToast(msg, "warning");
