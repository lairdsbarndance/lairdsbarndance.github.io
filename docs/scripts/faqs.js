async function generate_noticeboard(noticeboard, obj, heading_font_style, sort_by = "heading") {
    const REM = 16; // no reliable way to get user-set value
    const maximised_history = [];
    const post_it_width = parseFloat(noticeboard.getAttribute("data-post-it-width").split("rem")[0]) * REM;

    const font_families = {
        "cursive": "Caveat",
        "sans-serif": "PT Sans",
        "playful": "Cantora One"
    }

    noticeboard.style.setProperty("--post-it-width", (post_it_width / REM) + "rem");
    
    const post_its_obj = obj.filter(
        el => el.heading !== "Introduction" && el.heading && el.content
    );

    const post_its_container = $el(".post-its");
    post_its_container.style.setProperty("--font-family", `${font_families[heading_font_style]}, sans-serif`);
    post_its_container.style.setProperty("--font-weight", heading_font_style === "playful" ? "100" : "900");

    const col_count = Math.max(Math.floor(
        noticeboard.offsetWidth / (post_it_width)
    ), 1);

    const columns = [];

    for (let i = 0; i < col_count; i++) {
        const sub_container = $el("div");
        // sub_container.style.zIndex = (col_count - i);
        post_its_container.appendChild(sub_container);

        columns.push({
            element: sub_container,
            height: 0,
            index: i
        });
    }

    const sorted_post_its = [...post_its_obj].sort(
        (a, b) => b[sort_by].length - a[sort_by].length
    );

    // How strongly the middle column is favoured.
    // Higher = middle column will be allowed to become taller.
    const middle_preference = 0.125;

    sorted_post_its.forEach((post_it, index) => {
        const middle = (col_count - 1) / 2;
        const shortest_column = columns.reduce((shortest, column) => {
            const is_middle = column.index === middle;
            // Make the middle column appear shorter when comparing it.
            const effective_height =
                column.height * (is_middle ? 1 - middle_preference : 1);
            const shortest_effective_height =
                shortest.height *
                (shortest.index === middle ? 1 - middle_preference : 1);
            return effective_height < shortest_effective_height
                ? column
                : shortest;
        });

        shortest_column.element.appendChild(
            generate_post_it(
                post_it.heading,
                post_it.content,
                index
            )
        );

        shortest_column.height += post_it[sort_by].length;
    });

    noticeboard.appendChild(post_its_container);
    
    noticeboard.innerHTML += `
    <div class="board">
        <div class="corner"></div>
        <div class="connector" style="--img-path: url(../assets/notice_board/top.png)"></div>
        <div class="corner" style="--rotation: 90deg"></div>
        <div class="connector" style="--img-path: url(../assets/notice_board/left.png)"></div>
        <div class="felt"></div>
        <div class="connector" style="--img-path: url(../assets/notice_board/right.png)"></div>
        <div class="corner" style="--rotation: -90deg"></div>
        <div class="connector" style="--img-path: url(../assets/notice_board/bottom.png)"></div>
        <div class="corner" style="--rotation: -180deg"></div>
    </div>
    `

    const post_its = $(".post-it");

    post_its.forEach(post_it => {
        const p = post_it.querySelector(".info");
        post_it.classList.add("minimised");

        post_it.onclick = () => {
            const is_minimising = !post_it.classList.contains("minimised");
            post_it.classList.toggle("minimised");

            if (!is_minimising) {
                scroll_to_el(post_it, 60)
                post_it.classList.add("maximised");
                Array.from(post_its).filter(el => el !== post_it).forEach(el => el.classList.remove("maximised"));

                function handle_scroll() {
                    p.classList.add("scroll")
                }

                p.addEventListener("scroll", handle_scroll, {once: true})

                const existing_index =
                    maximised_history.indexOf(post_it);

                if (existing_index !== -1)
                    maximised_history.splice(existing_index, 1);

                maximised_history.push(post_it);

                if (maximised_history.length > 2) {
                    const oldest = maximised_history.shift();
                    oldest.classList.add("minimised");
                }

            } else {
                p.removeEventListener("scroll", handle_scroll);
                p.classList.remove("scroll");
                post_it.classList.remove("maximised");

                const index =
                    maximised_history.indexOf(post_it);

                if (index !== -1)
                    maximised_history.splice(index, 1);
            }
        };
    });
}

async function main() {
    const noticeboard = $(".noticeboard")[0];
    const faqs_res = await fetch_data("faqs");
    const faqs_obj = parse_document(faqs_res, null, merge_content = false);
    const intro_par_text = faqs_obj.find(el => el.heading === "Introduction").content[0];
    const heading_font_style = get_website_variable("FAQs Post-it-notes Font");
    $(".intro")[0].textContent = intro_par_text;

    generate_noticeboard(noticeboard, faqs_obj, heading_font_style, "heading");
    fade_in($(".intro")[0], 0, 0);
    generate_background();
    noticeboard.querySelectorAll(".pre-render").forEach(el => {fade_in(el); activate(el)});
}

promise__initial_page_rendering.then(() => main())