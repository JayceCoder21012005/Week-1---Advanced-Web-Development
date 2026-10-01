# Lời thuyết trình + câu hỏi dự kiến

> Đọc kèm [PRESENTATION.md](PRESENTATION.md). Chữ in nghiêng trong `[...]` là thao tác, không đọc.
> Tổng ~6 phút nếu nói tốc độ bình thường (~130 từ/phút).

**Chuẩn bị trước khi lên:**
```bash
npm run db:up
npm run db:reset
npm run dev
```
Mở sẵn 2 cửa sổ: trình duyệt ở `http://localhost:3000/docs` và terminal ở thư mục project.

---

## Phần 1 — Problem (~1 phút)

> Em chào thầy. Đề tuần này là xây Cart API: người dùng xem danh sách sản phẩm, tạo giỏ hàng, thêm, đổi số lượng và xóa sản phẩm trong giỏ.
>
> Nhưng câu hỏi chính em đặt ra là: **làm sao để một nhóm khác dùng được API này mà không cần đọc source code?**
>
> Em thấy cần đủ 4 thứ:
> - Thứ nhất, **một contract rõ ràng**: có đường dẫn nào, gửi body gì, nhận về status nào, kể cả khi lỗi. Em dùng OpenAPI 3.1 cho việc này.
> - Thứ hai, **request sai phải bị chặn ngay ở cửa**, trước khi chạm tới database.
> - Thứ ba, **lỗi phải đoán trước được**: mọi lỗi, kể cả lỗi 500, đều trả cùng một dạng JSON, có trường `code` cố định để client dựa vào đó mà xử lý.
> - Thứ tư, **truy vết được**: mỗi request có một `request_id`, từ response lỗi mình tìm ra đúng dòng log trên server.

---

## Phần 2 — Solution (~1.5 phút)

> Về cách làm, em chọn hướng **code-first**: dùng thư viện `zod` để viết schema trong TypeScript, rồi dùng `zod-to-openapi` để **sinh ra file OpenAPI từ chính schema đó**.
>
> Lý do em chọn code-first: **chỉ có một nguồn schema duy nhất**. Cùng một schema vừa dùng để validate request, vừa dùng để sinh tài liệu. Nên không thể xảy ra lỗi kinh điển là tài liệu ghi một kiểu mà code kiểm tra một kiểu khác. Thêm nữa, TypeScript tự suy ra kiểu dữ liệu từ schema, em không phải khai báo type hai lần.
>
> Một lý do thực tế nữa: em dùng Next.js, mà Next.js không có sẵn middleware đọc file YAML để validate như `express-openapi-validator` bên Express. Nên đi theo code-first sẽ gọn hơn.
>
> Ngoài phần schema, em có thêm mấy thành phần chính:
> - Một hàm bọc tên là `withApi`, bọc quanh **mọi** route. Nó sinh `request_id`, gắn vào header `X-Request-Id`, ghi log, và bắt mọi exception để đổi thành error contract. Nếu là lỗi không lường trước thì trả về 500 `INTERNAL_ERROR`, **stack trace chỉ nằm trong log, không bao giờ gửi cho client**.
> - Phần logging em dùng `pino`, ghi log dạng JSON, mỗi request một dòng. Em có cấu hình để che password, token và header Authorization.
> - Còn những luật cần đọc database, như sản phẩm còn bán không, còn đủ hàng không, giỏ đã checkout chưa, thì nằm ở tầng service, chạy trong transaction. Giá tiền luôn được **đọc từ DB**, không bao giờ lấy từ body client gửi lên.
>
> Về status code, em phân biệt theo đề: **400** là sai schema, **404** là không tìm thấy resource trên URL, **409** là xung đột với trạng thái hiện tại như hết hàng hay giỏ đã đóng, còn **422** là body đúng schema nhưng tham chiếu sai, ví dụ sản phẩm đã ngừng bán.

---

## Phần 3 — Demo (~2 phút)

> Giờ em xin demo.

*[Đang ở trang /docs]*

> Đây là trang `/docs`, được sinh hoàn toàn từ schema. Thầy có thể thấy đủ 6 endpoint, mỗi endpoint liệt kê hết các status có thể trả về và có example.

*[Mở POST /carts → bấm Test Request → Send]*

> Đầu tiên em tạo một giỏ hàng. Kết quả trả về 201, và header `Location` chỉ tới giỏ vừa tạo. Em copy cái id này.

*[Mở POST /carts/{cartId}/items → dán cartId → chọn example "quantity = 0" → Send]*

> Bây giờ em cố tình gửi một request sai: `quantity` bằng 0, trong khi schema quy định từ 1 đến 10.
>
> API trả về 400, `code` là `VALIDATION_ERROR`, trong `details` chỉ có đúng trường `quantity`, kèm lý do "must be >= 1". Thầy để ý trường `request_id`, nó **trùng với header `X-Request-Id`** ở đây.

*[Copy vài ký tự đầu của request_id → sang terminal]*

```bash
grep <dán request_id> logs/app.log
```

> Sang terminal, em tìm theo đúng `request_id` đó trong file log, ra đúng một dòng: method, path, status 400, thời gian xử lý, mã lỗi và chi tiết lỗi. Nghĩa là khi client báo lỗi kèm `request_id`, bên vận hành tìm được ngay request đó trên server.

*[Nếu còn thời gian: quay lại /docs, chọn example "Product ngừng bán" → Send]*

> Thêm một ví dụ: body này đúng schema hoàn toàn, nhưng sản phẩm đã ngừng bán, nên API trả về 422 `PRODUCT_UNAVAILABLE`. Đây là lỗi mà schema không bắt được, phải đọc database mới biết.

---

## Phần 4 — Evidence & Trade-off (~1.5 phút)

> Về bằng chứng, em viết một script nghiệm thu, chạy bằng lệnh `npm run test:acceptance`. Kết quả là **26 trên 26 kịch bản đều pass**.
>
> Script này reset database về dữ liệu mẫu, chạy lần lượt từng dòng trong ma trận nghiệm thu của đề, rồi **đối chiếu mọi response thật với file OpenAPI** bằng thư viện Ajv. Ajv là validator độc lập, không dùng chung code với zod, nên nếu code trả sai so với spec thì script sẽ báo.
>
> Một vài kịch bản đáng chú ý:
> - Thiếu `product_id` hoặc có field lạ: em đếm số dòng trong bảng `cart_items` trước và sau request, **database không đổi**.
> - Thêm 2 sản phẩm rồi xem giỏ: `subtotal_cents` bằng đúng 330.000, khớp với số tính tay từ dữ liệu seed.
> - Script **tắt hẳn PostgreSQL** rồi gọi API: nhận về 500 đúng error contract, không có stack trace. Bật DB lên lại thì API tự hồi phục.
>
> Về trade-off:
> - Code-first thì spec phụ thuộc vào thư viện sinh. Muốn chỉnh chi tiết OpenAPI phải qua metadata, không sửa YAML trực tiếp được. Bù lại thì spec và validation không bao giờ lệch nhau.
> - Tồn kho hiện tại **chỉ được kiểm tra, chưa được giữ chỗ**. Hai giỏ hàng có thể cùng thêm hết số hàng còn lại. Việc giữ hàng em để cho phần checkout.
> - Những gì em **chưa kiểm tra**: chưa có test tải đồng thời nhiều request vào cùng một giỏ; đường dẫn không tồn tại vẫn trả trang 404 mặc định của Next.js chứ chưa theo error contract; file log chưa xoay vòng.
>
> Ngoài ra, khi đọc đề em thấy slide ghi `CHECK (stock <= 0)`. Em nghĩ đây là lỗi đánh máy nên đã sửa thành `stock >= 0`, vì nếu giữ nguyên thì không thể seed 3 sản phẩm còn hàng.
>
> Phần trình bày của em đến đây là hết, em cảm ơn thầy đã lắng nghe.

---

# Câu hỏi thầy có thể hỏi

Mỗi câu có câu trả lời ngắn để nói, kèm ý cốt lõi cần hiểu.

### A. OpenAPI và contract

**1. OpenAPI là gì? Khác gì so với viết tài liệu bằng Word hay README?**
> OpenAPI là file mô tả API theo định dạng máy đọc được (JSON/YAML): path, method, tham số, body, response, lỗi. Tài liệu viết tay thì không có công cụ nào kiểm tra được nó đúng hay sai so với code. Còn OpenAPI thì công cụ đọc được: sinh trang `/docs`, validate request, và đối chiếu response. Nên khi code lệch spec là phát hiện được.

*Cốt lõi:* tài liệu **kiểm chứng được bằng máy**.

**2. Contract-first và code-first khác nhau thế nào? Sao em chọn code-first?**
> Contract-first là viết file `openapi.yaml` trước rồi mới code theo. Code-first là viết schema trong code rồi sinh spec ra. Em chọn code-first vì chỉ có một nguồn schema, không lo hai nơi lệch nhau, và Next.js không có middleware validate từ YAML có sẵn.
> Contract-first hợp hơn khi nhiều team cần thống nhất API **trước khi** ai đó bắt đầu code, ví dụ frontend và backend làm song song.

**3. Làm sao em chắc là spec và code không bị lệch nhau?**
> Có hai lớp. Thứ nhất, cả validation lẫn spec cùng sinh từ một schema zod. Thứ hai, script nghiệm thu đối chiếu response **thật** với `/openapi.json` bằng Ajv, một thư viện khác hẳn. Nếu em trả về một status không khai báo trong spec, hoặc thiếu một field, thì script fail.

### B. Validation

**4. Validation bằng schema và kiểm tra nghiệp vụ khác nhau chỗ nào?**
> Schema chỉ kiểm tra được **hình dạng dữ liệu**: kiểu, định dạng, giới hạn, có field lạ hay không, ví dụ `quantity` phải là số nguyên từ 1 đến 10. Còn những gì phải **đọc database** mới biết thì là nghiệp vụ: sản phẩm có tồn tại không, còn bán không, đủ tồn kho không, giỏ đã checkout chưa.

**5. Tại sao `quantity: "2"` (chuỗi) lại bị từ chối? Chuyển thành số 2 không được sao?**
> Contract nói `quantity` là `integer`. Nếu server tự ép kiểu thì client gửi sai mà vẫn chạy, sau này rất khó phát hiện, và hành vi không khớp với tài liệu. Nhưng query string như `?limit=20` thì luôn là chuỗi theo bản chất của URL, nên ở đó em có chuyển sang số.

**6. Tại sao phải chặn field lạ (`additionalProperties: false`)?**
> Để client gửi nhầm tên trường, ví dụ `quanity`, thì bị báo lỗi ngay thay vì bị lờ đi. Và để chặn client gửi những trường không được phép, ví dụ tự gửi `price`.

**7. "Request sai không chạm DB" — em chứng minh thế nào?**
> Validation chạy trước mọi câu query. Trong script nghiệm thu, em đếm số dòng `cart_items` trước và sau khi gửi request sai, hai số bằng nhau.

**8. Database đã có `CHECK (quantity BETWEEN 1 AND 10)` rồi, sao còn validate ở API?**
> Nếu chỉ dựa vào DB thì vi phạm CHECK sẽ thành exception, rơi vào 500, trong khi đúng ra phải là 400. Và thông báo lỗi của DB không theo error contract. Constraint ở DB là lớp bảo vệ cuối cùng, còn validation ở API là để trả lỗi đúng cho client.

**9. Required, optional và null khác nhau thế nào?**
> Required là key bắt buộc phải có. Optional là key được phép vắng mặt. Null là key **có mặt** nhưng giá trị bằng null, và chỉ hợp lệ khi schema cho phép. Client phải xử lý "không có key" khác với "key bằng null".

### C. Status code và error contract

**10. Phân biệt 400, 404, 409, 422.**
> 400 là request sai schema. 404 là resource trên URL không có. 409 là request hợp lệ nhưng xung đột với trạng thái hiện tại: hết hàng, giỏ đã đóng, sản phẩm đã có trong giỏ. 422 là body đúng schema nhưng tham chiếu tới thứ không dùng được, ví dụ sản phẩm ngừng bán.

**11. Sao hết hàng là 409, còn ngừng bán lại là 422?**
> Hết hàng phụ thuộc **trạng thái lúc đó**: số tồn kho thay đổi theo thời gian, nhập thêm hàng thì cùng request đó lại thành công. Còn ngừng bán là bản thân dữ liệu tham chiếu không hợp lệ, gửi lại bao nhiêu lần cũng vậy.

**12. Tại sao lỗi cần trường `code` khi đã có `message`?**
> `message` là để hiển thị cho người dùng, có thể đổi câu chữ hoặc dịch sang ngôn ngữ khác. `code` là chuỗi cố định để **chương trình** rẽ nhánh, ví dụ `if (code === "INSUFFICIENT_STOCK")`. Nếu client so sánh theo message thì chỉ cần sửa một chữ là client hỏng.

**13. Sao lỗi 500 không được trả stack trace?**
> Stack trace, câu SQL hay thông tin kết nối làm lộ cấu trúc bên trong cho kẻ tấn công. Client cũng không làm gì được với những thông tin đó. Nên client chỉ nhận `INTERNAL_ERROR` kèm `request_id`, còn chi tiết nằm trong log để developer tra.

**14. Sao xóa thành công trả 204 chứ không phải 200?**
> 204 nghĩa là thành công và không có body. Xóa xong thì không còn gì để trả về.

**15. Sao tạo cart trả 201 và header `Location`?**
> 201 nghĩa là đã tạo một resource mới. Header `Location` cho client biết URL của resource đó để gọi tiếp.

### D. Logging

**16. `request_id` dùng để làm gì?**
> Để nối ba thứ lại với nhau: response client nhận, header `X-Request-Id`, và dòng log trên server. Khi người dùng báo lỗi kèm `request_id`, mình `grep` ra đúng request đó trong hàng nghìn dòng log.

**17. Response lỗi đã nói rõ lỗi gì rồi, sao còn cần log?**
> Response chỉ cho **client** biết lỗi gì. Log cho **người vận hành** biết lỗi xảy ra ở đâu, lúc nào, request nào, mất bao lâu, và với lỗi 500 thì có cả stack trace. Client không thấy được những thông tin này.

**18. Sao log dạng JSON chứ không phải text thường?**
> Log JSON thì máy lọc được theo từng trường, ví dụ lọc theo `request_id`, theo `status` lớn hơn hoặc bằng 500, hay theo `code`, và đẩy được vào các công cụ như ELK hoặc Loki. Text thường thì phải dùng regex rất khó.

**19. Những gì không được ghi vào log?**
> Password, token, header Authorization, cookie. Log thường được nhiều người xem và lưu lâu, nên lộ ra là thành lỗ hổng bảo mật. Em cấu hình `redact` trong pino để tự che các trường này.

### E. Nghiệp vụ và database

**20. Sao không nhận giá tiền từ client?**
> Client có thể bị sửa, ví dụ người dùng tự gửi `price: 1`. Giá luôn phải đọc từ DB. Đây là nguyên tắc "không tin client".

**21. Transaction và `SELECT … FOR UPDATE` dùng để làm gì?**
> Để hai request cùng sửa một giỏ không giẫm lên nhau. Ví dụ hai request cùng kiểm tra "sản phẩm chưa có trong giỏ" rồi cùng thêm vào. `FOR UPDATE` khóa dòng cart, nên request thứ hai phải chờ request thứ nhất xong mới được kiểm tra.

**22. Có migration rồi, seed và reset để làm gì?**
> Migration tạo cấu trúc bảng và có lịch sử, chạy lại được trên mọi máy. Seed tạo dữ liệu mẫu cố định để test, ví dụ một sản phẩm hết hàng, một sản phẩm ngừng bán. Reset đưa DB về trạng thái ban đầu, để script nghiệm thu lần nào chạy cũng cho cùng kết quả.

**23. Sao lưu giá bằng `price_cents` kiểu integer mà không dùng số thực?**
> Số thực (float) bị sai số khi cộng tiền, ví dụ 0.1 + 0.2 ra 0.30000000000000004. Lưu bằng đơn vị nhỏ nhất dưới dạng số nguyên thì tính toán chính xác.

---

## Mẹo khi trả lời

- Câu nào không chắc thì trả lời theo khung: **"Cái này giải quyết vấn đề gì → nếu không làm thì sao"**. Hầu hết câu hỏi đều quy về việc client có dùng được API mà không cần đọc source hay không.
- Nếu thầy hỏi tới phần chưa làm, ví dụ chạy đồng thời hay giữ chỗ tồn kho, thì nói thẳng là **chưa kiểm tra**, kèm hướng sẽ làm. Như vậy tốt hơn là đoán.
