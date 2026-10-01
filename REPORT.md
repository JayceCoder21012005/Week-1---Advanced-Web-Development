# Báo cáo Block 01: RESTful API có contract (OpenAPI, validation và logging)

Môn học: Advanced Web Development

Nhóm 07

| MSSV | Họ và tên |
|---|---|
| 23127159 | Phạm Lê Thái Bảo |
| 23127183 | Phạm Vũ Ngọc Duy |
| 23127102 | Lê Quang Phúc |

## 1. Tóm tắt kết quả

Nhóm xây dựng Cart API gồm 6 endpoint theo đề: xem danh sách sản phẩm, tạo giỏ hàng, xem giỏ, thêm sản phẩm, đổi số lượng và xóa sản phẩm khỏi giỏ. Ngoài phần chức năng, nhóm tập trung vào câu hỏi mà đề đặt ra: làm sao để một nhóm khác dùng được API này mà không phải đọc mã nguồn. Kết quả cuối cùng gồm:

- Tài liệu OpenAPI 3.1 sinh tự động tại `/openapi.json`, trang tài liệu tương tác tại `/docs`, có ví dụ cho mọi status.
- Validation chạy từ cùng một nguồn schema với spec. Request sai bị trả 400 trước khi chạm vào cơ sở dữ liệu.
- Mọi lỗi, kể cả 500, 404 do sai đường dẫn và 405 do sai method, đều trả về cùng một dạng JSON.
- Mỗi request có một `request_id`, xuất hiện ở header `X-Request-Id`, trong body lỗi và trong dòng log trên server.
- Script nghiệm thu chạy lại được, đạt 28/28 kịch bản, trong đó mọi response được đối chiếu với spec.

Phần dưới đây giải thích từng lựa chọn của nhóm và lý do không dùng các phương án khác.

## 2. Các lựa chọn của nhóm

### 2.1. Stack: Next.js 16 và TypeScript

Nhóm chọn Next.js với TypeScript vì cả nhóm đã quen với hệ sinh thái JavaScript và TypeScript, và Next.js cho phép đặt API, trang tài liệu `/docs` và một giao diện demo nhỏ trong cùng một project. Chỉ cần một lệnh `npm run dev` là chạy được toàn bộ. Route Handlers của Next.js nhận `Request` và trả `Response` theo chuẩn Web, không phải API riêng của framework, nên phần nghiệp vụ của nhóm (đặt trong thư mục `lib/`) không phụ thuộc vào Next.js. Cách tổ chức route theo thư mục cũng khớp với đường dẫn REST: file `app/carts/[cartId]/items/[productId]/route.ts` chính là `/carts/{cartId}/items/{productId}`.

Nhóm không chọn Spring Boot. Spring Boot có hệ sinh thái rất mạnh cho bài này (springdoc-openapi, Bean Validation), nhưng nhóm chưa quen Java bằng TypeScript, và lượng cấu hình cùng mã khởi tạo khá lớn so với 6 endpoint. Nếu dùng Spring Boot, nhóm sẽ mất nhiều thời gian cho framework hơn là cho phần contract mà đề muốn tập trung.

Nhóm không chọn Express hay Fastify dù đây là lựa chọn tự nhiên cho một API thuần. Express có thư viện `express-openapi-validator` rất hợp với hướng contract-first, nhưng nhóm muốn có giao diện demo và trang tài liệu trong cùng project, và với Express thì phải tự dựng thêm phần này. Nhóm cũng không chọn NestJS vì framework này khá nặng (module, decorator, dependency injection) so với quy mô bài.

Nhóm cũng ghi nhận nhược điểm của Next.js: không có middleware gắn theo từng route như Express. Nhóm bù lại bằng hàm bọc `withApi` (trình bày ở mục 2.11) để gom phần sinh `request_id`, ghi log và xử lý lỗi về một chỗ.

### 2.2. Hướng làm: code-first thay vì contract-first

Nhóm chọn code-first: viết schema bằng zod trong code, rồi sinh file OpenAPI từ chính các schema đó. Lý do chính là chỉ có một nguồn schema duy nhất. Slide về các lỗi thường gặp có nêu lỗi "hai nguồn schema", tức spec viết một kiểu còn code kiểm tra một kiểu khác. Khi cùng một schema vừa dùng để kiểm tra request vừa dùng để sinh tài liệu thì lỗi này không thể xảy ra. Ví dụ `z.strictObject(...)` vừa khiến spec có `additionalProperties: false`, vừa khiến validation từ chối field lạ.

Nhóm không chọn contract-first vì Next.js không có middleware đọc file YAML để kiểm tra request như `express-openapi-validator`. Nếu viết `openapi.yaml` trước, nhóm sẽ phải tự nối validator với từng route, đồng thời vẫn phải viết lại kiểu TypeScript cho handler, tức là lại có hai nguồn. Nhóm hiểu contract-first sẽ phù hợp hơn khi nhiều nhóm cần thống nhất API trước khi bắt đầu viết code, ví dụ frontend và backend làm song song.

### 2.3. Thư viện validation: zod

Nhóm chọn zod (phiên bản 4) kết hợp `@asteasolutions/zod-to-openapi` vì TypeScript suy ra kiểu trực tiếp từ schema zod, không phải khai báo kiểu hai lần, và thư viện sinh spec hỗ trợ OpenAPI 3.1.

Nhóm không chọn Joi vì Joi không suy ra kiểu TypeScript tốt và không có công cụ sinh OpenAPI 3.1 được duy trì tốt. Nhóm không chọn class-validator vì thư viện này yêu cầu viết class kèm decorator, hợp với NestJS hơn là với Route Handlers. Phương án viết JSON Schema rồi kiểm tra bằng Ajv cũng được cân nhắc, nhưng khi đó nhóm phải tự viết thêm kiểu TypeScript cho dữ liệu đã kiểm tra. Ajv vẫn được dùng, nhưng ở vai trò khác (mục 2.14).

Một chi tiết quan trọng là lỗi của zod không được trả thẳng ra ngoài. Hàm `toDetails` trong `lib/api/validate.ts` chuyển từng lỗi của zod thành cặp `{ field, issue }` theo error contract, tránh lỗi "định dạng lỗi của thư viện lọt ra" mà đề có nhắc.

### 2.4. Documentation: Scalar

Nhóm chọn Scalar API Reference để hiển thị `/openapi.json` thành trang `/docs`. Scalar có giao diện gọn, cho phép gửi request thật ngay trên trang, hiển thị đầy đủ header của response (thuận tiện khi demo `X-Request-Id`), và hiển thị tốt các ví dụ request được đặt tên như "Sai: quantity = 0" hay "Product ngừng bán".

Nhóm không chọn Swagger UI vì giao diện cũ và rối hơn khi một endpoint có nhiều ví dụ lỗi, dù Swagger UI vẫn là lựa chọn phổ biến và ổn định. Nhóm không chọn Redoc vì bản miễn phí chỉ hiển thị tài liệu, không có chức năng gửi request thử, trong khi đề yêu cầu demo gửi một request sai từ `/docs`.

Vì cả ba công cụ đều đọc cùng một file spec, việc đổi công cụ không ảnh hưởng đến contract. Nhược điểm của Scalar trong bài là thư viện được tải từ CDN, nên trang `/docs` cần kết nối internet.

Để tài liệu dễ đọc cho cả người và công cụ tự động (trình sinh client, AI agent), nhóm khai báo các phần dùng chung một lần trong `components` rồi tham chiếu bằng `$ref`: header `RequestId`, các response lỗi như `ValidationError`, `CartNotFound`, `InternalError`. Nhờ vậy kích thước spec giảm khoảng 36% so với bản đầu tiên, trong khi nội dung không đổi.

### 2.5. Cơ sở dữ liệu: PostgreSQL

Nhóm chọn PostgreSQL vì dữ liệu giỏ hàng có quan hệ rõ ràng giữa giỏ, các món trong giỏ và sản phẩm, và bài toán cần khóa ngoại, ràng buộc `CHECK` và transaction để số lượng không bị sai. Đề bài cũng cho sẵn lược đồ bằng cú pháp PostgreSQL (kiểu `uuid`, `text`).

Nhóm không chọn MySQL vì MySQL không có kiểu `uuid` gốc và chỉ hỗ trợ đầy đủ ràng buộc `CHECK` từ phiên bản 8.0.16, nên phải chỉnh lại lược đồ của đề. Nhóm không chọn MongoDB vì MongoDB không có khóa ngoại, việc giữ toàn vẹn dữ liệu giữa giỏ và sản phẩm sẽ phải tự xử lý trong code.

Khi đọc đề, nhóm phát hiện ràng buộc `CHECK (stock <= 0)` trên slide. Nếu giữ nguyên thì không thể seed sản phẩm còn hàng, nên nhóm xem đây là lỗi đánh máy và dùng `CHECK (stock >= 0)`. Ghi chú này được để lại trong file migration.

### 2.6. Cách chạy cơ sở dữ liệu: Docker thay vì dịch vụ cloud

Nhóm chọn chạy PostgreSQL 17 bằng Docker Compose. Ai clone project về cũng có đúng phiên bản cơ sở dữ liệu chỉ với lệnh `npm run db:up`, không cần cài đặt vào máy và không cần chia sẻ mật khẩu.

Trong quá trình làm, nhóm có cân nhắc dùng Neon (PostgreSQL trên cloud) nhưng quyết định không dùng vì ba lý do. Thứ nhất, ma trận nghiệm thu có kịch bản "tắt PostgreSQL rồi gọi API", với Docker nhóm tắt được cơ sở dữ liệu thật bằng `docker stop`, còn với dịch vụ cloud thì không. Thứ hai, Neon tạm ngủ khi không có ai dùng, request đầu tiên sau đó có thể bị chậm và làm buổi demo kém ổn định. Thứ ba, Docker không phụ thuộc vào kết nối mạng.

Container được map ra cổng 5433 thay vì 5432 mặc định để tránh xung đột với PostgreSQL có thể đã cài sẵn trên máy.

### 2.7. Truy cập cơ sở dữ liệu: SQL thuần với thư viện pg

Nhóm chọn viết SQL thuần với thư viện `pg` vì đề đã cho sẵn các câu `CREATE TABLE`, và viết SQL trực tiếp giúp giữ đúng lược đồ đó. Phần nghiệp vụ cần transaction và câu lệnh `SELECT ... FOR UPDATE`, khi viết SQL thì nhóm thấy rõ câu lệnh nào đang chạy và khóa những gì.

Nhóm không chọn Prisma vì Prisma dùng ngôn ngữ schema riêng, sinh ra migration của riêng nó và cần thêm bước sinh client. Với 3 bảng, chi phí này lớn hơn lợi ích. Nhóm không chọn TypeORM vì cách khai báo bằng decorator và hành vi đồng bộ lược đồ tự động dễ gây khó hiểu. Drizzle là một lựa chọn nhẹ và hợp lý, nhưng nhóm thấy không cần thiết ở quy mô hiện tại. Nhược điểm của SQL thuần là nhóm phải tự khai báo kiểu cho kết quả truy vấn.

### 2.8. Migration, seed và reset: script tự viết

Nhóm chọn tự viết script `scripts/db.ts` gồm ba lệnh `migrate`, `seed` và `reset`. Lệnh `migrate` chạy các file SQL trong `db/migrations/` theo thứ tự, mỗi file trong một transaction, và lưu tên file đã chạy vào bảng `schema_migrations` để chạy lại nhiều lần cũng không lỗi. Script chỉ khoảng 70 dòng, dễ đọc và không thêm phụ thuộc nào.

Nhóm không chọn Flyway vì công cụ này chạy trên Java, nặng so với project Node.js. Nhóm không chọn `node-pg-migrate` hay `knex` vì cả hai đều yêu cầu viết migration theo API riêng của thư viện, trong khi nhóm muốn giữ file migration là SQL thuần giống với đề.

Dữ liệu seed được thiết kế để phủ đủ các tình huống kiểm thử: 3 sản phẩm đang bán còn hàng, 1 sản phẩm hết hàng, 1 sản phẩm ngừng bán và 1 giỏ đã checkout. Các UUID được cố định để script nghiệm thu và ví dụ trong tài liệu dùng lại được.

### 2.9. Thư viện logging: pino

Nhóm chọn pino vì thư viện này ghi log dạng JSON theo mặc định và có tốc độ cao. Hàm `logger.child({ request_id })` cho phép mọi dòng log trong một request tự mang theo `request_id` mà không cần truyền tay, và tùy chọn `redact` che các trường nhạy cảm như `password`, `token`, header `authorization` và `cookie`, đúng với yêu cầu "không ghi password, token, header Authorization" của đề.

Nhóm không chọn morgan vì morgan chỉ ghi access log dạng một dòng văn bản, khó gắn thêm các trường như mã lỗi hay chi tiết lỗi, và không ghi được log từ bên trong logic xử lý. Nhóm không chọn winston vì winston cần cấu hình nhiều hơn để ra JSON có cấu trúc và chậm hơn pino. Winston vẫn là lựa chọn tốt khi cần đẩy log tới nhiều đích khác nhau.

Mỗi request tạo đúng một dòng log gồm `request_id`, method, đường dẫn, status, thời gian xử lý và mã lỗi nếu có. Mức log phản ánh loại kết quả: `info` cho thành công, `warn` cho lỗi 4xx và `error` cho lỗi 5xx. Với lỗi 500, stack trace chỉ được ghi trong log, không bao giờ xuất hiện trong response.

### 2.10. Nơi lưu log: stdout và file, chưa dùng ELK

Nhóm chọn ghi log ra console (stdout) và file `logs/app.log`. Cách này đủ cho yêu cầu của đề: từ `request_id` trong response lỗi, chỉ cần chạy `grep <request_id> logs/app.log` là tìm được đúng dòng log.

Nhóm chưa dùng ELK Stack (Elasticsearch, Logstash, Kibana) vì bộ này gồm ít nhất ba dịch vụ, cần vài GB RAM và nhiều cấu hình, trong khi bài chỉ có một service và chạy trên máy cá nhân. Grafana Loki nhẹ hơn ELK nhưng vẫn cần thêm Loki, Promtail và Grafana. Dù vậy, vì log đã ở dạng JSON có cấu trúc, khi cần có thể đẩy thẳng vào ELK hoặc Loki mà không phải sửa code.

Nhóm không lưu log vào cơ sở dữ liệu. Khi cơ sở dữ liệu gặp sự cố thì vẫn phải ghi được lỗi đó, mà đó lại là lúc cần log nhất. Ngoài ra, ghi vào cơ sở dữ liệu làm mỗi request phải thêm một câu `INSERT`.

### 2.11. request_id và hàm bọc withApi

Nhóm chọn sinh một UUID mới ở server cho mỗi request. Mã này được trả trong header `X-Request-Id`, trong body lỗi và trong dòng log. Nhóm không nhận `X-Request-Id` do client gửi lên để tránh trường hợp client gửi mã trùng hoặc giả mạo làm log bị lẫn. Đánh đổi là khi có nhiều service gọi nhau thì chưa nối được mã giữa các service, nhưng bài hiện chỉ có một service.

Toàn bộ phần dùng chung được đặt trong hàm `withApi` (`lib/api/handler.ts`). Hàm này sinh `request_id`, bắt mọi exception, chuyển thành response theo error contract và ghi log. Nhờ việc tạo response lỗi chỉ nằm ở một chỗ, không endpoint nào trả lỗi sai định dạng. Nhóm không đặt phần này trong `proxy` (tên mới của middleware trong Next.js 16) vì `proxy` không bắt được exception xảy ra bên trong route handler.

Mặc định Next.js trả trang HTML khi gọi đường dẫn không tồn tại và trả 405 với body rỗng khi gọi sai method, cả hai đều không theo error contract. Nhóm thêm route `app/[...slug]/route.ts` để trả 404 `NOT_FOUND`, và hàm `rejectOtherMethods` để trả 405 `METHOD_NOT_ALLOWED` kèm header `Allow`.

### 2.12. Error contract và status code

Mọi lỗi có dạng `{ code, message, details, request_id }` theo đúng slide. Trường `code` là chuỗi cố định để chương trình phía client rẽ nhánh. Trường `message` chỉ để hiển thị và có thể đổi câu chữ mà không làm hỏng client. Danh sách mã lỗi được khai báo một lần và đưa vào spec dưới dạng `enum`.

Về status, nhóm theo đúng bảng trong đề và thống nhất cách phân biệt 409 với 422 như sau. Hết hàng là 409 vì nó phụ thuộc vào trạng thái lúc gọi: khi kho được nhập thêm, cùng một request sẽ thành công. Sản phẩm ngừng bán là 422 vì bản thân dữ liệu được tham chiếu không dùng được, gửi lại bao nhiêu lần cũng vậy.

Nhóm vẫn kiểm tra `quantity` ở API dù cơ sở dữ liệu đã có `CHECK (quantity BETWEEN 1 AND 10)`. Nếu chỉ dựa vào cơ sở dữ liệu, vi phạm ràng buộc sẽ thành lỗi 500 thay vì 400, đúng là lỗi "dựa vào lỗi DB" mà đề cảnh báo.

### 2.13. Xử lý đồng thời: khóa bi quan với SELECT ... FOR UPDATE

Mọi thao tác ghi vào giỏ chạy trong một transaction và bắt đầu bằng việc khóa dòng giỏ hàng bằng `SELECT ... FOR UPDATE`. Hai request cùng sửa một giỏ sẽ được xử lý lần lượt, không xảy ra trường hợp cả hai cùng thấy "sản phẩm chưa có trong giỏ" rồi cùng thêm vào.

Nhóm không chọn khóa lạc quan (thêm cột `version` và thử lại khi xung đột) vì phải đổi lược đồ của đề và client phải xử lý việc thử lại. Nhóm cũng không chỉ dựa vào khóa chính `(cart_id, product_id)` để chặn trùng, vì khi đó lỗi vi phạm khóa sẽ thành 500 nếu không bắt riêng. Một giỏ hàng hiếm khi bị nhiều request sửa cùng lúc, nên khóa bi quan không ảnh hưởng đáng kể đến hiệu năng.

Giá sản phẩm luôn được đọc từ cơ sở dữ liệu, API không nhận giá từ client. Tiền được lưu bằng số nguyên theo đơn vị nhỏ nhất (`price_cents`) để tránh sai số của số thực.

### 2.14. Kiểm thử nghiệm thu: script riêng kết hợp Ajv

Nhóm chọn viết một script TypeScript (`scripts/acceptance.ts`, chạy bằng `npm run test:acceptance`) cho toàn bộ ma trận nghiệm thu. Script reset cơ sở dữ liệu, chạy từng kịch bản, đếm số dòng trong bảng `cart_items` trước và sau request sai để chứng minh cơ sở dữ liệu không đổi, tắt và bật lại container PostgreSQL cho kịch bản lỗi 500, rồi ghi kết quả ra `docs/acceptance-report.md`.

Mọi response được đối chiếu với `/openapi.json` bằng Ajv. Nhóm cố ý dùng Ajv thay vì zod ở bước này vì Ajv là validator độc lập, không dùng chung mã với phần sinh spec. Nếu server trả một status chưa khai báo hoặc thiếu một trường so với spec, script sẽ báo lỗi. Nhóm đã thử đưa dữ liệu sai vào để chắc Ajv thật sự phát hiện được sai lệch.

Nhóm không chọn Postman kết hợp Newman vì collection được lưu dưới dạng JSON khó đọc khi xem lại thay đổi, và khó thực hiện các bước như truy vấn trực tiếp cơ sở dữ liệu hay tắt container. Nhóm không chọn Jest kết hợp Supertest vì phần kiểm thử ở đây là kiểm thử đầu cuối trên server thật đúng như ma trận của đề, không cần framework unit test.

## 3. Kết quả nghiệm thu

| Nhóm kịch bản | Số kịch bản | Kết quả |
|---|---|---|
| Request sai (quantity 0, 11, "2"; thiếu product_id; field lạ; JSON hỏng; cartId sai; limit vượt giới hạn) | 9 | Đạt |
| Nghiệp vụ (subtotal, thêm trùng, đổi số lượng, xóa, ngừng bán, vượt tồn kho, giỏ đã đóng) | 15 | Đạt |
| Đường dẫn không tồn tại, method không hỗ trợ | 2 | Đạt |
| request_id có trong log | 1 | Đạt |
| Tắt PostgreSQL rồi gọi API | 1 | Đạt |
| Tổng | 28 | 28/28 |

Bảng chi tiết từng kịch bản nằm trong file `docs/acceptance-report.md`.

## 4. Hạn chế và hướng phát triển

- Chưa có bài kiểm tra cho nhiều request đồng thời vào cùng một giỏ. Mã nguồn đã khóa dòng bằng `FOR UPDATE` nhưng chưa được kiểm chứng bằng test.
- Tồn kho mới chỉ được kiểm tra, chưa được giữ chỗ. Hai giỏ khác nhau có thể cùng thêm hết số hàng còn lại. Việc giữ hàng thuộc về chức năng checkout ở các tuần sau.
- Response thành công chưa được kiểm tra lại bằng schema khi chạy thật, mà được đảm bảo bằng kiểu TypeScript lúc biên dịch và bằng Ajv trong script nghiệm thu.
- File log chưa có cơ chế xoay vòng. Khi triển khai thật, nhóm sẽ đẩy log sang Loki hoặc ELK.
- Trang `/docs` cần internet vì Scalar được tải từ CDN.
