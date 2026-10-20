content = (
    "第一回 风起青萍\n"
    "这是一段中文测试文字，包含标点。\n"
    "第二章 云涌九州\n"
    "又一段内容，用于验证编码识别是否正常。\n"
    "第三章 决战之巅\n"
    "最后一章，GBK 编码测试完成。\n"
)
with open(r"E:\workbuddy\2026-10-12-09-22-17\novel-reader\test\sample-gbk.txt", "wb") as f:
    f.write(content.encode("gbk"))
print("gbk sample written")
