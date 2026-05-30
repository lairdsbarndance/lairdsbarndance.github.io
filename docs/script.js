const κ = "AIzaSyAM07AIfBXXRU0Y8MbpzySSVtCAG3xjHr0";
const spreadsheet_id = '1pSWHmoRA7jzdl81XBYCijammbIVrjFhTFQ6Q3Ema29s'; 
const PAGE = "Home";

async function fetch_data(named_range) {
    const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}` +
        `?ranges=${encodeURIComponent(named_range)}` +
        `&includeGridData=true` +
        `&key=${κ}`
    );

    const data = await res.json();
    const rows = data.sheets?.[0]?.data?.[0]?.rowData ?? [];

    let output = [];

    rows.forEach(row => {
        const values = row.values || [];

        let row_has_content = false;
        let row_cells = [];

        for (let i = 0; i < values.length; i++) {
            const text = values[i]?.formattedValue;

            if (!text || text.trim() === "") continue;

            row_has_content = true;

            row_cells.push({
                text: text,
                heading: values[i]?.userEnteredFormat?.textFormat?.bold === true
            });
        }

        if (!row_has_content) {
            output.push({ type: "row_break" });
        } else {
            output.push({ type: "row", cells: row_cells });
        }
    });

    return output;
}

function parse_table(json) {
    let trunc = json.filter(arr => (arr.filter(el => el === '').length === 0 && arr.length > 0))
    let parsed = [];
    trunc.forEach((arr, i) => {
        let obj = Object();
        arr.forEach((el, j) => {
            let formatted_el = el;
            const key = trunc[0][j];
            const bool_map = {"TRUE": true, "FALSE": false};
            if(Object.keys(bool_map).includes(el)) formatted_el = bool_map[el];
            if(key === "Date" && el !== key) {
                formatted_el = parse_gb_date(el);
            }
            if(key.includes("comma-separated")) formatted_el = el.split(",")
            obj[key] = formatted_el;
        })
        if(i > 0) parsed.push(obj)
    })
    return parsed;
}

function parse_document(flat_data, pages) {
    let sections = [];
    let current = null;

    let new_paragraph = true;

    flat_data.forEach(item => {
        if (item.type === "row_break") {
            new_paragraph = true;
            return;
        }

        if (item.type !== "row") return;

        item.cells.forEach(cell => {
            const text = cell.text;
            if (cell.heading) {
                current = {
                    heading: text,
                    content: [],
                    tag: text.toLowerCase().split(" ").join("_")
                };

                sections.push(current);

                new_paragraph = true;
                return;
            }
            if (!current) return;

            const last_index = current.content.length - 1;
            if (new_paragraph || current.content.length === 0) {current.content.push(text)}
            else {current.content[last_index] += "<br>" + text;}
            new_paragraph = false;
        });
    });

    sections = sections.filter(obj => !pages.includes(obj.heading));

    return sections;
}

function parse_events(events, files) {
    let parsed = [];

    events.forEach(event => {
        let parsed_event = event;
        const date = (new Date(event["Date"])).toLocaleDateString("en-GB");
        const event_files = files.filter(file => file.folder.includes(date));
        if(event_files) parsed_event["files"] = event_files;
        parsed.push(parsed_event)
    });

    return parsed;
}

async function fetch_sheet_names() {
    const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}` +
        `?fields=sheets(properties(title))` +
        `&key=${κ}`
    );

    const data = await res.json();

    return data.sheets.map(sheet => sheet.properties.title);
}

async function fetch_events() {
    const events_res = await fetch_data("events"); const files_res = await fetch_data("files");
    const events = parse_table(events_res); const files = parse_table(files_res);
    const parsed_events = parse_events(events, files);
    return parsed_events;
}  

function parse_gb_date(str) {
    const split = str.split("/");
    const mm = split[1].length > 1 ? split[1] : `0${split[1]}`;
    const dd = split[0].length > 1 ? split[0] : `0${split[0]}`;
    const yyyy = split[2].length > 2 ? split[2] : `20${split[2]}`;
    return Date.parse([mm, dd, yyyy].join("/"));
}

function populate_dyn_containers(data) {
    const containers = $(".dyn-container");
    containers.forEach(container => {
        const target_obj = data.find(entry => entry.tag === container.getAttribute("data-dyn-tag"))
        const heading = el(container.getAttribute("data-dyn-heading"));
        container.appendChild(heading);

        heading.innerHTML = target_obj.heading;
        target_obj.content.forEach(entry => {
            const dom_type = container.getAttribute("data-dyn-content");
            const content_el = el(dom_type);
            content_el.innerHTML = entry;
            if(dom_type === "a") content_el.href = entry
            container.appendChild(content_el)
        })
        
    })
}

function generate_nav(pages) {
    const header = $("header")[0];
    const f_pages = pages.filter(page => !page.includes("readonly"));

    let nav_struct = `            
    <h3><a href="./index.html">lairdsbarndance.band</a></h3>
    <nav>
        <ul></ul>
    </nav>
    `

    header.innerHTML = nav_struct;

    const ul = header.querySelector("ul");
    const is_homepage = (window.location.href.split("/").pop()) === "index.html";

    f_pages.forEach(page => {
        let url = `${is_homepage ? "./pages/" : "./"}${page.toLowerCase().split(" ").join("_")}.html`;
        if(page === "Home") url = (is_homepage ? "" : ".") + "./index.html"; // since all pages bar index are stored in subdir

        const anchor = el("a");
        anchor.href = url;
        anchor.textContent = page;
        ul.appendChild(anchor);
    })
}

function generate_leather(els) {
    els.forEach(el => {
        const is_rough_border = el.classList.contains("rough-border");
        const bg_struct = `
            <div class="leather-background">
            <div class="displacement"></div>
            <div class="dimples"></div>
            <div class="glow"></div>
            <div class="shine"></div>
        </div>
        `;
        const borders_struct = `
        <div class="leather-borders">
            <div class="top"></div>
            <div class="right"></div>
            <div class="bottom"></div>
            <div class="left"></div>
        </div>
        `;
        if(!is_rough_border) el.insertAdjacentHTML("beforeend", borders_struct);
        el.insertAdjacentHTML("afterbegin", bg_struct);
    })
}

async function main() { 
    // const pages = await fetch_sheet_names();
    const pages = [
    "Home",
    "Meet the Band",
    "History",
    "Packages",
    "FAQs",
    "Events",
    "Contact",
    "Gallery Metadata (readonly)"
];
    // const res = await fetch_data(PAGE);
    // const res = await fetch_data("contact_prompt");
    // const data = parse_document(res, pages);
    // populate_dyn_containers(data);
    generate_nav(pages);
    generate_leather($(".leather"))
}

main();