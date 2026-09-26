promise__initial_page_rendering.then(() => main())

async function main() {
    const contact_res = await fetch_data("contact_info");
    const contact_obj = parse_document(contact_res, null, merge_content = false);
    await populate_dyn_containers(contact_obj);

    const form = $("form")[0];
    form.onclick = () => {activate(form); form.onclick = ""}
    form.onmouseover = () => {activate(form); form.onclick = ""}
    // main logic

    generate_background();
}