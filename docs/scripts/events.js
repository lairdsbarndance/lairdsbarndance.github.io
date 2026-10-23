function handle_click_event(event, is_expanded) {
    const package_type = event.querySelector(".package-type");
    package_type.textContent = package_type.textContent.replace(is_expanded ? "," : ":", is_expanded ? ":" : ",")
}

async function main() {
    const events_obj = await fetch_events();
    const events_container = $(".events")[0];
    const banner = $(".banner")[0];
    const main_el = $("main")[0];
    const timeline = $(".timeline")[0];

    const package_colours = [
        {package: "Fiddler and Caller", colour: "#C0A4EF"}, 
        {package: "2-piece and caller", colour: "#DE5959"}, 
        {package: "3-piece and caller", colour: "#FFD78D"}, 
        {package: "4-piece and caller", colour: "#FFA88D"}, 
        {package: "Bluegrass and caller", colour: "#82FFF0"}
    ];

    // generate events here
    const original_padding_top = getComputedStyle(main_el).getPropertyValue("--padding-top");
    banner.classList.add("minimise"); banner.style.transitionDuration = "0ms";
    events_container.style.setProperty("--max-height", (document.documentElement.clientHeight - banner.getBoundingClientRect().bottom - 100) + "px");
    timeline.style.left = events_container.getBoundingClientRect().left + "px";
    banner.classList.remove("minimise");
    banner.style.transitionDuration = "";

    events_container.addEventListener("scroll", (e) => {
        if(events_container.scrollTop !== 0) {
            main_el.style.setProperty("--padding-top", banner.getBoundingClientRect().bottom + "px");
            banner.classList.add("minimise");
        } else {
            main_el.style.setProperty("--padding-top", original_padding_top);
            banner.classList.remove("minimise")
        }
    })

    const events = $(".event");
    events.forEach(event => {
        event.addEventListener("click", () => {
            event.classList.toggle("expanded");
            handle_click_event(event, event.classList.contains("expanded"))
        })
    })

    console.log(events_obj)
}

promise__initial_page_rendering.then(() => main())