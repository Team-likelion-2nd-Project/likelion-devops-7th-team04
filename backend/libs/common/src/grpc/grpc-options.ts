// libs/common/src/grpc/grpc-options.ts
import { GrpcOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

// 👇 export 키워드가 필수입니다!
export function getGrpcOptions(
  packageName: string,
  protoFile: string,
  url: string,
): GrpcOptions {
  return {
    transport: Transport.GRPC,
    options: {
      package: packageName,
      protoPath: join(process.cwd(), 'dist/libs/common/proto', protoFile),
      url: url,
      // defaults: true가 없으면 @grpc/proto-loader가 비어있는 repeated 필드(예: 빈 배열)를
      // 아예 생략해버려서, 수신 측 JS 객체에서 해당 필드가 []가 아니라 undefined로 나타난다
      // (예: 예약 가능 여부 데이터가 하나도 없는 달을 조회하면 availabilities가 undefined).
      loader: {
        defaults: true,
      },
    },
  };
}
