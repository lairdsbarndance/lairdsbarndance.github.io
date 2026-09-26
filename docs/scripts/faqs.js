function generate_noticeboard(noticeboard, obj, heading_font_style) {
    const post_its_obj = obj.filter(
        el => el.heading !== "Introduction" && el.heading && el.content
    );
    const post_its_container = $el(".post-its");
    const col_count = Math.floor(
        noticeboard.offsetWidth / ((20 + 1) * 16)
    ); // 20rem width + 1rem gap
    const columns = [];

    for (let i = 0; i < col_count; i++) {
        const sub_container = $el("div");

        post_its_container.appendChild(sub_container);

        columns.push({
            element: sub_container,
            height: 0
        });
    }

    const sorted_post_its = [...post_its_obj].sort(
        (a, b) => b.content.length - a.content.length
    );
    sorted_post_its.forEach(post_it => {

        const shortest_column = columns.reduce(
            (shortest, column) =>
                column.height < shortest.height ? column : shortest
        );

        shortest_column.element.appendChild(
            generate_post_it(
                post_it.heading,
                post_it.content,
                1
            )
        );
        shortest_column.height += post_it.content.length;
    });
    noticeboard.appendChild(post_its_container);

    const post_its = $(".post-it");
    const maximised_history = [];

    post_its.forEach(post_it => {
        const p = post_it.querySelector("p");
        post_it.classList.add("minimised");
        post_it.onclick = () => {
            const is_minimising = !post_it.classList.contains("minimised");
            post_it.classList.toggle("minimised");
            p.style.overflowY = "hidden";
            setTimeout(() => {
                p.style.overflowY = "auto";
            }, 250);
            if (!is_minimising) {
                const existing_index = maximised_history.indexOf(post_it);
                if (existing_index !== -1) maximised_history.splice(existing_index, 1);
                maximised_history.push(post_it);

                if (maximised_history.length > 3) {
                    const oldest = maximised_history.shift();
                    oldest.classList.add("minimised");
                }
            } else {
                const index = maximised_history.indexOf(post_it);
                if (index !== -1) {
                    maximised_history.splice(index, 1);
                }
            }
        };
    });
}

async function main() {
    const noticeboard = $(".noticeboard")[0];
    const faqs_res = await fetch_data("faqs");
    const faqs_obj = parse_document(faqs_res);
    const intro_par_text = faqs_obj.find(el => el.heading === "Introduction").content[0];
    const heading_font_style = get_website_variable("FAQs Post-it-notes Font");
    $(".intro")[0].textContent = intro_par_text;

    generate_noticeboard(noticeboard, faqs_obj, heading_font_style);
    noticeboard.querySelectorAll(".pre-render").forEach(el => {fade_in(el); activate(el)});
}

promise__initial_page_rendering.then(() => main())