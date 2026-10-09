async function main() {
    const h4 = $(".page-top-description")[0];
    const packages_res = await fetch_data("packages");
    const packages_obj = parse_document(packages_res);
    h4.innerHTML = packages_obj.find(el => el.heading === "General Information")["content"][0];
    
    const f_packages = packages_obj.filter(el => el.heading !== "General Information");
    console.log(f_packages);

    generate_background();
    fade_in(h4);
}

promise__initial_page_rendering.then(() => main());