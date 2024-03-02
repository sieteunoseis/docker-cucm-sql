SELECT
  mrgl.name AS mrgl,
  mrg.name AS mrg,
  d.name AS resource
FROM
  mediaresourcelist mrgl
  INNER JOIN mediaresourcelistmember AS mrm ON mrm.fkmediaresourcelist = mrgl.pkid
  INNER JOIN mediaresourcegroup mrg ON mrm.fkmediaresourcegroup = mrg.pkid
  INNER JOIN mediaresourcegroupmember mgm ON mgm.fkmediaresourcegroup = mrg.pkid
  INNER JOIN device d ON mgm.fkdevice = d.pkid