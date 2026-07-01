// components/dragdrop.js

export function createDragDrop(element, onFileSelected) {

    const input = element.querySelector("#file-input");

    element.addEventListener("click", () => {
        input.click();
    });

    input.addEventListener("change", (event) => {

        const file = event.target.files[0];

        if (file) {
            onFileSelected(file);
        }

        // Позволяет выбрать тот же файл повторно
        input.value = "";

    });

    element.addEventListener("dragover", (event) => {

        event.preventDefault();

        element.classList.add("drag");

    });

    element.addEventListener("dragleave", () => {

        element.classList.remove("drag");

    });

    element.addEventListener("drop", (event) => {

        event.preventDefault();

        element.classList.remove("drag");

        const files = event.dataTransfer?.files;

        if (!files || files.length === 0) {
            console.warn("No files dropped");
            return;
        }

        const file = files[0];

        console.log("Dropped file:", file);

        onFileSelected(file);

    });

}