SELECT
  COUNT(Device.name) Device_count,
  DevicePool.name Device_Pool,
  typemodel.name Device_Type
FROM
  Device
  INNER JOIN DevicePool ON Device.fkDevicePool = DevicePool.pkid
  INNER JOIN typemodel ON device.tkmodel = typemodel.enum
GROUP BY
  DevicePool.name,
  typemodel.name