"""Create a UTF-8 ZIP backup, excluding temporary build output."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent
target = root.parent / (root.name + '.zip')
with ZipFile(target, 'w', compression=ZIP_DEFLATED) as archive:
    for item in sorted(root.rglob('*')):
        if item.is_file() and '.build' not in item.relative_to(root).parts and item.name != '.DS_Store':
            archive.write(item, item.relative_to(root.parent).as_posix())
with ZipFile(target) as archive:
    assert archive.testzip() is None
    assert all(info.flag_bits & 0x800 for info in archive.infolist())
    print(f'{target.name}: {len(archive.infolist())} files, UTF-8 filenames, integrity passed')
