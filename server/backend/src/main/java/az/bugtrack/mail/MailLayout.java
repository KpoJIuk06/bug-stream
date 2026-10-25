package az.bugtrack.mail;

/** One simple, client-safe HTML layout for every e-mail (inline styles, no images, no tracking). */
public final class MailLayout {

    private MailLayout() {
    }

    /**
     * @param title     first line, bold
     * @param bodyHtml  already escaped HTML (use {@link #esc})
     * @param button    button text, or null
     * @param link      button link, or null
     * @param footer    small grey text, or null
     */
    public static String html(String title, String bodyHtml, String button, String link, String footer) {
        StringBuilder sb = new StringBuilder();
        sb.append("<div style=\"font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#18202c;max-width:560px\">");
        sb.append("<p style=\"font-size:16px;font-weight:600;margin:0 0 12px\">").append(esc(title)).append("</p>");
        sb.append(bodyHtml);
        if (button != null && link != null) {
            sb.append("<p style=\"margin:20px 0\"><a href=\"").append(esc(link))
              .append("\" style=\"background:#0d6e6e;color:#fff;padding:9px 16px;border-radius:7px;text-decoration:none\">")
              .append(esc(button)).append("</a></p>");
        }
        if (footer != null) {
            sb.append("<p style=\"color:#8a94a3;font-size:12px;margin-top:20px\">").append(esc(footer)).append("</p>");
        }
        sb.append("</div>");
        return sb.toString();
    }

    public static String p(String text) {
        return "<p style=\"margin:0 0 10px;white-space:pre-wrap\">" + esc(text) + "</p>";
    }

    public static String code(String code) {
        return "<p style=\"font-size:28px;font-weight:700;letter-spacing:6px;font-family:Consolas,monospace;margin:16px 0\">"
                + esc(code) + "</p>";
    }

    public static String esc(String s) {
        return s == null ? "" : s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
