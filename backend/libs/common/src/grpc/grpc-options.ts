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
    },
  };
}
