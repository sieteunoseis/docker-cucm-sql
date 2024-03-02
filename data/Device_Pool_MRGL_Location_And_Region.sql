SELECT
  dp.name AS dp,
  mrgl.name AS mrgl,
  loc.name AS location,
  reg.name AS region
FROM
  devicepool dp
  INNER JOIN mediaresourcelist mrgl ON dp.fkmediaresourcelist = mrgl.pkid
  INNER JOIN location loc ON dp.fklocation = loc.pkid
  INNER JOIN region reg ON dp.fkregion = reg.pkid