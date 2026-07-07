import { Link, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { Prose } from "../../components/docs/Prose";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { MARKDOWN_DOC_SOURCES } from "../../lib/docsMarkdownSources";
import { renderMarkdownToSafeHtml } from "../../lib/renderMarkdown";

export function MarkdownDocPage() {
    const { pathname } = useLocation();
    const markdown = MARKDOWN_DOC_SOURCES[pathname];

    const html = useMemo(() => {
        if (!markdown) return null;
        return renderMarkdownToSafeHtml(markdown);
    }, [markdown]);

    if (!markdown || !html) {
        return (
            <Prose>
                <DocsPageHeaderForRoute />
                <p>
                    This documentation page is not available in the app. Return to the{" "}
                    <Link to="/docs" className="font-semibold text-[#00685f] hover:underline">
                        documentation home
                    </Link>
                    .
                </p>
            </Prose>
        );
    }

    return (
        <Prose>
            <DocsPageHeaderForRoute />
            <div className="markdown-doc" dangerouslySetInnerHTML={{ __html: html }} />
        </Prose>
    );
}
