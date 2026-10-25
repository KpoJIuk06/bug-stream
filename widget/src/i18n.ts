/** Widget texts: Russian, English, Azerbaijani. Language — from init({ lang }) or the browser (English by default). */

export type Lang = "ru" | "en" | "az";

const ru = {
  report: "Сообщить об ошибке",
  "menu.video": "Записать видео",
  "menu.videoHint": "Браузер спросит разрешение — нажмите «Поделиться»",
  "menu.screenshot": "Скриншот",
  "menu.screenshotHint": "с консолью и сетью за последние минуты",
  "menu.replay": "Последние 2 минуты",
  "menu.replayHint": "что происходило на странице до этого момента",
  "menu.replayNotReady": "запись страницы только началась",
  "menu.replayOff": "выключено на этом сайте",
  "bar.label": "Запись",
  "bar.pause": "Пауза",
  "bar.resume": "Продолжить",
  "bar.stop": "Стоп",
  "bar.cancel": "Отмена",
  "bar.cancelConfirm": "Остановить запись без сохранения?",
  "toast.recover": "Запись прервалась при перезагрузке страницы. Отправить то, что успело записаться?",
  "toast.open": "Открыть",
  "toast.recordFailed": "Не удалось начать запись: ",
  "toast.shotFailed": "Не удалось сделать скриншот: ",
  "toast.noVideo": "Видео не записалось — попробуйте ещё раз",
  "toast.notFound": "Запись не найдена",
  "toast.replayNotReady": "Запись страницы ещё не накопилась — попробуйте через несколько секунд",
  "form.heading": "Отчёт об ошибке",
  "form.title": "Заголовок",
  "form.titlePh": "Что пошло не так",
  "form.description": "Описание",
  "form.descriptionPh": "Шаги воспроизведения, что ожидали увидеть, что получили",
  "form.service": "Сервис",
  "form.serviceAuto": "Определить по адресу",
  "form.severity": "Важность",
  "sev.none": "Не указана",
  "sev.LOW": "Низкая",
  "sev.MEDIUM": "Средняя",
  "sev.HIGH": "Высокая",
  "sev.CRITICAL": "Критическая",
  "form.discard": "Удалить",
  "form.discardConfirm": "Удалить запись без отправки?",
  "form.send": "Отправить",
  "form.sending": "Отправляем…",
  "form.close": "Закрыть",
  "form.screenshotAlt": "Скриншот страницы",
  "form.replayNote": "Запись страницы за {d} — в отчёте откроется как видео действий",
  "err.keyInvalid": "Ключ виджета неверный или отключён — проверьте настройки проекта",
  "err.origin": "Этот сайт не разрешён для ключа виджета — добавьте его адрес в настройках проекта",
  "err.rateLimit": "Слишком много отчётов за час — попробуйте позже",
  "err.server": "Сервер отчётов недоступен: {s}",
  "err.serverRetry": "Сервер отчётов недоступен: {s}. Запись не потеряна — попробуйте ещё раз.",
  "done.title": "Отчёт отправлен",
  "done.text": "Спасибо! Ссылку можно передать разработчикам.",
  "done.open": "Открыть отчёт",
  "done.copy": "Скопировать ссылку",
  "done.copied": "Ссылка скопирована",
};

type Dict = Record<keyof typeof ru, string>;

const en: Dict = {
  report: "Report a bug",
  "menu.video": "Record video",
  "menu.videoHint": "The browser will ask for permission — click “Share”",
  "menu.screenshot": "Screenshot",
  "menu.screenshotHint": "with console and network of the last minutes",
  "menu.replay": "Last 2 minutes",
  "menu.replayHint": "what happened on the page up to now",
  "menu.replayNotReady": "page recording has just started",
  "menu.replayOff": "turned off on this site",
  "bar.label": "Recording",
  "bar.pause": "Pause",
  "bar.resume": "Resume",
  "bar.stop": "Stop",
  "bar.cancel": "Cancel",
  "bar.cancelConfirm": "Stop recording without saving?",
  "toast.recover": "Recording was interrupted by a page reload. Send what was recorded?",
  "toast.open": "Open",
  "toast.recordFailed": "Could not start recording: ",
  "toast.shotFailed": "Could not take a screenshot: ",
  "toast.noVideo": "Nothing was recorded — please try again",
  "toast.notFound": "Recording not found",
  "toast.replayNotReady": "Page recording is not ready yet — try again in a few seconds",
  "form.heading": "Bug report",
  "form.title": "Title",
  "form.titlePh": "What went wrong",
  "form.description": "Description",
  "form.descriptionPh": "Steps to reproduce, what you expected, what happened",
  "form.service": "Service",
  "form.serviceAuto": "Detect by page address",
  "form.severity": "Severity",
  "sev.none": "Not set",
  "sev.LOW": "Low",
  "sev.MEDIUM": "Medium",
  "sev.HIGH": "High",
  "sev.CRITICAL": "Critical",
  "form.discard": "Delete",
  "form.discardConfirm": "Delete the recording without sending?",
  "form.send": "Send",
  "form.sending": "Sending…",
  "form.close": "Close",
  "form.screenshotAlt": "Page screenshot",
  "form.replayNote": "Page recording, {d} — opens in the report as a video of actions",
  "err.keyInvalid": "The widget key is invalid or disabled — check the project settings",
  "err.origin": "This site is not allowed for the widget key — add its address in the project settings",
  "err.rateLimit": "Too many reports this hour — please try later",
  "err.server": "Report server is unavailable: {s}",
  "err.serverRetry": "Report server is unavailable: {s}. The recording is kept — please try again.",
  "done.title": "Report sent",
  "done.text": "Thank you! You can share the link with the developers.",
  "done.open": "Open report",
  "done.copy": "Copy link",
  "done.copied": "Link copied",
};

const az: Dict = {
  report: "Xəta barədə bildir",
  "menu.video": "Video yaz",
  "menu.videoHint": "Brauzer icazə istəyəcək — «Paylaş» düyməsini basın",
  "menu.screenshot": "Ekran şəkli",
  "menu.screenshotHint": "son dəqiqələrin konsol və şəbəkə məlumatları ilə",
  "menu.replay": "Son 2 dəqiqə",
  "menu.replayHint": "bu ana qədər səhifədə baş verənlər",
  "menu.replayNotReady": "səhifənin yazısı yenicə başlayıb",
  "menu.replayOff": "bu saytda söndürülüb",
  "bar.label": "Yazı",
  "bar.pause": "Fasilə",
  "bar.resume": "Davam et",
  "bar.stop": "Dayandır",
  "bar.cancel": "Ləğv et",
  "bar.cancelConfirm": "Yazı saxlanmadan dayandırılsın?",
  "toast.recover": "Səhifə yenidən yükləndiyi üçün yazı yarımçıq qaldı. Yazılan hissə göndərilsin?",
  "toast.open": "Aç",
  "toast.recordFailed": "Yazını başlatmaq alınmadı: ",
  "toast.shotFailed": "Ekran şəklini çəkmək alınmadı: ",
  "toast.noVideo": "Video yazılmadı — yenidən cəhd edin",
  "toast.notFound": "Yazı tapılmadı",
  "toast.replayNotReady": "Səhifənin yazısı hələ toplanmayıb — bir neçə saniyədən sonra yenidən cəhd edin",
  "form.heading": "Xəta hesabatı",
  "form.title": "Başlıq",
  "form.titlePh": "Nə səhv getdi",
  "form.description": "Təsvir",
  "form.descriptionPh": "Təkrarlama addımları, nə gözləyirdiniz, nə aldınız",
  "form.service": "Servis",
  "form.serviceAuto": "Ünvana görə müəyyən et",
  "form.severity": "Vaciblik",
  "sev.none": "Göstərilməyib",
  "sev.LOW": "Aşağı",
  "sev.MEDIUM": "Orta",
  "sev.HIGH": "Yüksək",
  "sev.CRITICAL": "Kritik",
  "form.discard": "Sil",
  "form.discardConfirm": "Yazı göndərilmədən silinsin?",
  "form.send": "Göndər",
  "form.sending": "Göndərilir…",
  "form.close": "Bağla",
  "form.screenshotAlt": "Səhifənin ekran şəkli",
  "form.replayNote": "Səhifənin yazısı, {d} — hesabatda hərəkətlərin videosu kimi açılacaq",
  "err.keyInvalid": "Vidcet açarı yanlışdır və ya söndürülüb — layihə ayarlarını yoxlayın",
  "err.origin": "Bu sayt vidcet açarı üçün icazəli deyil — onun ünvanını layihə ayarlarına əlavə edin",
  "err.rateLimit": "Bir saatda həddən çox hesabat göndərilib — bir az sonra yenidən cəhd edin",
  "err.server": "Hesabat serveri əlçatan deyil: {s}",
  "err.serverRetry": "Hesabat serveri əlçatan deyil: {s}. Yazı itməyib — yenidən cəhd edin.",
  "done.title": "Hesabat göndərildi",
  "done.text": "Təşəkkürlər! Linki tərtibatçılara göndərə bilərsiniz.",
  "done.open": "Hesabatı aç",
  "done.copy": "Linki kopyala",
  "done.copied": "Link kopyalandı",
};

const DICTS: Record<Lang, Dict> = { ru, en, az };
let lang: Lang = detect();

function detect(): Lang {
  const l = (typeof navigator !== "undefined" ? navigator.language : "en").slice(0, 2).toLowerCase();
  return l === "ru" || l === "az" ? l : "en";
}

export function setLang(l: string | undefined) {
  lang = l && l in DICTS ? (l as Lang) : detect();
}

export function getLang(): Lang {
  return lang;
}

export type Key = keyof typeof ru;

export function t(key: Key, vars: Record<string, string | number> = {}): string {
  return DICTS[lang][key].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

/** Event counters in the form: "3 console errors", "3 ошибки в консоли", "konsolda 3 xəta". */
export function counter(kind: "console" | "network" | "requests" | "actions", n: number): string {
  if (lang === "en") {
    const s = n === 1 ? "" : "s";
    return { console: `${n} console error${s}`, network: `${n} network error${s}`, requests: `${n} request${s}`, actions: `${n} action${s}` }[kind];
  }
  if (lang === "az") {
    return { console: `konsolda ${n} xəta`, network: `${n} şəbəkə xətası`, requests: `${n} sorğu`, actions: `${n} hərəkət` }[kind];
  }
  const p = (one: string, few: string, many: string) => {
    const m10 = n % 10;
    const m100 = n % 100;
    return `${n} ${m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many}`;
  };
  return {
    console: `${p("ошибка", "ошибки", "ошибок")} в консоли`,
    network: `${p("ошибка", "ошибки", "ошибок")} сети`,
    requests: p("запрос", "запроса", "запросов"),
    actions: p("действие", "действия", "действий"),
  }[kind];
}
