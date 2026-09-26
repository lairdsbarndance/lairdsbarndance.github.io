promise__initial_page_rendering.then(() => main())

async function main() {
    const contact_res = await fetch_data("contact_info");
    const contact_obj = parse_document(contact_res, null, merge_content = false);
    await populate_dyn_containers(contact_obj);

    const form = $("form")[0];
    const modal = $("dialog")[0];

    modal.addEventListener("click", (e) => {
        if(!Array.from(modal.children).includes(e.target)) {
            modal.close();
        }
    })

    const result = $(".modal-text")[0];
    form.onclick = () => {activate(form); form.onclick = ""}
    form.onmouseover = () => {activate(form); form.onclick = ""}
    // main logic

    generate_background();

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(form);
        const object = Object.fromEntries(formData);
        const json = JSON.stringify(object);
        modal.showModal();
        result.innerHTML = "Please wait..."
        fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: json
            })
            .then(async (response) => {
                let json = await response.json();
                if (response.status == 200) {
                    result.textContent = json.message;
                    console.log(json.message);
                } else {
                    console.log(response);
                    result.textContent = json.message;
                    console.log(json.message);
                }
            })
            .catch(error => {
                console.log(error);
                result.textContent = "Something went wrong! Please contact us directly via our email address listed below.";
            })
            .then(function() {
                form.reset();
                setTimeout(() => {
                    modal.close();
                }, 500000);
            });
    });
}