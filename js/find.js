import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useMemo } from 'react';
import { List, Icons, ActionPanel, Action } from '@project-gauntlet/api/components';
import { Clipboard } from '@project-gauntlet/api/helpers';

const { os: os$1 } = Deno.build;
const OS_CMD$1 = Object.freeze({
    darwin: "open",
    windows: "explorer",
    linux: "xdg-open",
});
/** Open file or path with default application */
function open(target) {
    if (!Object.keys(OS_CMD$1).includes(os$1))
        throw new Error(`unsupported os: ${os$1}`);
    // Directory should be opened in default explorer. This is the only supported mode for windows
    target.endsWith(os$1 === 'windows' ? '\\' : '/');
    return new Deno.Command(OS_CMD$1[os$1], {
        args: [target],
    }).output();
}

const { os } = Deno.build;
const OS_CMD = Object.freeze({
    darwin: { cmd: "file", args: ["--mime-type", "-b"] },
    linux: { cmd: "file", args: ["--mime-type", "-b"] },
    fallback: { cmd: "file", args: ["--mime-type", "-b"] },
});
/** Get MIME type using file command */
function getMimeTypeSync(filePath) {
    if (!Object.keys(OS_CMD).includes(os)) {
        console.error(`unsupported os: ${os}. trying default command`);
    }
    try {
        const output = new Deno.Command(OS_CMD[os].cmd ?? OS_CMD.fallback.args, {
            args: [...OS_CMD[os].args ?? OS_CMD.fallback.args, filePath],
            stdout: "piped",
        }).outputSync();
        if (output.code === 0) {
            return new TextDecoder().decode(output.stdout).trim();
        }
    }
    catch (e) {
        console.error(e);
    }
    return 'text/plain';
}

const MIME = (mime) => {
    if (!mime)
        return 'Document';
    if (mime.includes('image'))
        return "Image";
    if (mime.includes('directory'))
        return "Folder";
    if (mime.includes('video'))
        return "Film";
    if (mime.includes('audio'))
        return "Music";
    if (mime.includes('application'))
        return "Code";
    if (mime.includes('html'))
        return "Code";
    if (mime.includes('text'))
        return "Text";
    return "Document";
};
function Finder() {
    const process = new Deno.Command("gf", {
        stdin: "piped",
        stderr: "null",
        stdout: "piped"
    }).spawn();
    try {
        if (!process.stdin || !process.stdout) {
            throw new Error("Failed to create pipes");
        }
        const writer = process.stdin.getWriter();
        const reader = process.stdout.getReader();
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const exit = () => writer.write(encoder.encode(`c:Exit`));
        const search = async (query) => {
            writer.write(encoder.encode(`q:${query}\n`));
            const res = await reader.read();
            const [len, ...lines] = decoder.decode(res.value).split('\n').filter(line => line.trim());
            return Promise.all(lines
                .map(async (path, id) => {
                const name = path.split('/').pop() || path;
                const mime = getMimeTypeSync(path);
                return { id, path, name, mime, data: null };
            }));
        };
        return { search, exit };
    }
    catch (error) {
        throw new Error(`Failed to spawn fuzzy-fd: ${error}`);
    }
}
const finder = Finder();
const readData = (file) => {
    if (file.mime?.startsWith("image")) {
        let data = Deno.readFileSync(file.path);
        file.data = data.buffer;
    }
    else if (file.mime?.startsWith("text")) {
        let data = Deno.readTextFileSync(file.path);
        file.data = data;
    }
};
function find () {
    const [searchText, setSearchText] = useState("");
    const [results, setResults] = useState([]);
    const [selectedFile, setSelectedFile] = useState();
    const details = useMemo(() => {
        if (typeof selectedFile != 'number')
            return undefined;
        if (results.length === 0)
            return undefined;
        const file = results[selectedFile];
        if (!file.data)
            readData(file);
        const fileinfo = Deno.lstatSync(file.path);
        return {
            ...fileinfo,
            f: file,
        };
    }, [selectedFile, results]);
    return (jsxs(List, { onItemFocusChange: id => setSelectedFile((id && parseInt(id)) || 0), actions: jsxs(ActionPanel, { children: [jsx(Action, { id: "open", label: "Open", onAction: (id) => id && open(results[parseInt(id)].path) }), jsx(Action, { id: "reveal", label: "Show in explorer", onAction: (id) => {
                        if (!id)
                            return;
                        const file = results[parseInt(id)];
                        let path = file.path;
                        if (file.mime && file.mime !== 'inode/directory') {
                            const idx = path.lastIndexOf(Deno.build.os === 'windows' ? '\\' : '/');
                            path = path.slice(0, idx + 1);
                        }
                        open(path);
                    } }), jsx(Action, { id: "copyFile", label: "Copy File", onAction: async (id) => {
                        if (!id)
                            return;
                        let file = results[parseInt(id)];
                        if (!file.data)
                            readData(file);
                        if (file.mime?.startsWith("text")) {
                            Clipboard.write({ "text/plain": file.data });
                        }
                        else {
                            Clipboard.write({ "image/png": file.data });
                        }
                    } }), jsx(Action, { id: "copyPath", label: "Copy Path", onAction: (id) => id && Clipboard.writeText(results[parseInt(id)].path) })] }), children: [jsx(List.SearchBar, { value: searchText, onChange: async (query = "") => {
                    setSearchText(query);
                    finder.search(query).then(setResults);
                }, placeholder: "Search files" }), results.map((file, i) => (jsx(List.Item, { id: file.id.toString(), title: file.name, icon: Icons[MIME(file.mime ?? '')] }, i))), details && (jsxs(List.Detail, { children: [jsxs(List.Detail.Metadata, { children: [jsx(List.Detail.Metadata.Value, { label: "Name", children: details.f.name }), jsx(List.Detail.Metadata.Value, { label: "Path", children: details.f.path }), details.f.mime != "inode/directory" && (jsx(List.Detail.Metadata.Value, { label: "Type", children: details.f.mime || 'Unknown' })), jsx(List.Detail.Metadata.Value, { label: "Size", children: fmtSize(details.size) }), jsx(List.Detail.Metadata.Value, { label: "Modified", children: details.mtime?.toLocaleString() || 'Unknown' }), jsx(List.Detail.Metadata.Value, { label: "Created", children: details.birthtime?.toLocaleString() || 'Unknown' }), jsx(List.Detail.Metadata.Value, { label: "Permissions", children: fmtPerms(details.mode) })] }), details.f.data && (jsx(List.Detail.Content, { children: details.f.mime?.startsWith('text') && (jsx(List.Detail.Content.Paragraph, { children: details.f.data })) }))] }))] }));
}
function fmtSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}
function fmtPerms(mode) {
    if (mode === null)
        return 'Unknown';
    const owner = (mode >> 6) & 7;
    const group = (mode >> 3) & 7;
    const other = mode & 7;
    const fmtTriad = (n) => {
        return ((n & 4) ? 'r' : '-') +
            ((n & 2) ? 'w' : '-') +
            ((n & 1) ? 'x' : '-');
    };
    return fmtTriad(owner) + fmtTriad(group) + fmtTriad(other);
}

export { find as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmluZC5qcyIsInNvdXJjZXMiOltdLCJzb3VyY2VzQ29udGVudCI6W10sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7In0=
