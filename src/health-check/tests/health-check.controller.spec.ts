import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckController } from '../health-check.controller';
import { HealthCheckService } from '../health-check.service';
import { GrpcMetricsInterceptor } from 'src/supervision/metrics/interceptors';

describe('HealthCheckController', () => {
  let controller: HealthCheckController;
  let service: jest.Mocked<HealthCheckService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthCheckController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            checkDatabaseConnection: jest.fn(),
          },
        },
      ],
    })
      .overrideInterceptor(GrpcMetricsInterceptor)
      .useValue({})
      .compile();

    controller = module.get<HealthCheckController>(HealthCheckController);
    service = module.get(HealthCheckService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('checkHealth', () => {
    it('should return healthy app response', () => {
      const result = controller.checkHealth();

      expect(result).toEqual({
        serving: true,
        message: 'User microservice is healthy',
      });
    });
  });

  describe('checkDatabaseConnection', () => {
    it('should return healthy response when DB is healthy', async () => {
      service.checkDatabaseConnection.mockResolvedValueOnce(true);

      const result = await controller.checkDatabaseConnection();

      expect(service.checkDatabaseConnection).toHaveBeenCalled();
      expect(result).toEqual({
        serving: true,
        message: 'Database connection is healthy',
      });
    });

    it('should return unhealthy response when DB is down', async () => {
      service.checkDatabaseConnection.mockResolvedValueOnce(false);

      const result = await controller.checkDatabaseConnection();

      expect(service.checkDatabaseConnection).toHaveBeenCalled();
      expect(result).toEqual({
        serving: false,
        message: 'Database connection failed',
      });
    });
  });
});
